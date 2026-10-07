# syntax=docker/dockerfile:1.7
#
# ScanReceipt build environment: Node + JDK 21 + Android SDK, the same for every developer and CI.
# iOS cannot be built here: Apple requires macOS + Xcode.
#
#   Toolchain for docker compose (dev server, tests, APK):  docker compose build
#   One-shot debug APK into ./dist, no setup at all:        docker build --target apk-export --output dist .

############################ toolchain ############################
FROM eclipse-temurin:21-jdk-noble AS toolchain

ARG NODE_MAJOR=24
ARG NPM_VERSION=12.0.1
ARG ANDROID_CMDLINE_TOOLS=13114758
ARG ANDROID_PLATFORM=android-36
ARG ANDROID_BUILD_TOOLS=36.0.0
ARG UID=1000
ARG GID=1000

ENV ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    GRADLE_USER_HOME=/home/dev/.gradle \
    NG_CLI_ANALYTICS=false \
    CAPACITOR_TELEMETRY=false \
    CI=true
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg unzip git \
 && curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && npm install -g npm@${NPM_VERSION} \
 && rm -rf /var/lib/apt/lists/*

# The Ubuntu base image ships a "ubuntu" user on UID 1000: replace it with "dev" on the host's UID
# so files written to the mounted project keep your ownership.
RUN (userdel -r ubuntu 2>/dev/null || true) \
 && groupadd -g ${GID} dev && useradd -m -u ${UID} -g ${GID} -s /bin/bash dev

RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
 && curl -fsSL -o /tmp/cmdline-tools.zip \
      https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS}_latest.zip \
 && unzip -q /tmp/cmdline-tools.zip -d /tmp \
 && mv /tmp/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest \
 && rm /tmp/cmdline-tools.zip \
 && yes | sdkmanager --licenses > /dev/null \
 && sdkmanager --install "platform-tools" "platforms;${ANDROID_PLATFORM}" "build-tools;${ANDROID_BUILD_TOOLS}" > /dev/null \
 # Writable SDK: Gradle can fetch a missing package itself (licenses are already accepted).
 && chown -R dev:dev ${ANDROID_HOME}

# Mount points for named volumes: created here so Docker gives them to "dev", not root.
RUN mkdir -p /app/node_modules /home/dev/.gradle /home/dev/.npm \
 && chown -R dev:dev /app /home/dev

USER dev
WORKDIR /app
CMD ["bash"]

############################ emulator (headless smoke test) ############################
# Needs /dev/kvm on the host (Linux). The ML Kit document scanner does not run in emulators:
# this stage checks that the app installs, starts and opens its database, not the camera flow.
FROM toolchain AS emulator
ARG ANDROID_PLATFORM=android-36
ARG SYSTEM_IMAGE=system-images;android-36;google_apis;x86_64
# The emulator links against X11/GL/audio libraries even with -no-window.
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends libx11-6 libx11-xcb1 libxext6 libxrender1 libxcomposite1 \
      libxcursor1 libxdamage1 libxi6 libxtst6 libxrandr2 libxkbfile1 libxkbcommon0 libxcb-cursor0 \
      libnss3 libpulse0 libasound2t64 libgl1 libegl1 libdbus-1-3 libfontconfig1 libbsd0 \
 && rm -rf /var/lib/apt/lists/*
USER dev
RUN sdkmanager --install "emulator" "${SYSTEM_IMAGE}" > /dev/null \
 && echo no | avdmanager create avd --name smoke --package "${SYSTEM_IMAGE}" --device pixel_7 --force > /dev/null
# Libraries for the emulator window (Qt xcb), used by the emulator-gui service.
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends libice6 libsm6 libxcb-icccm4 libxcb-image0 libxcb-keysyms1 \
      libxcb-render-util0 libxcb-shape0 libxcb-xinerama0 libxcb-xkb1 libxkbcommon-x11-0 libxcb-randr0 \
      libxcb-xfixes0 libxcb-sync1 libxcb-shm0 libxcb-util1 \
 && rm -rf /var/lib/apt/lists/*
USER dev
ENV PATH=$PATH:$ANDROID_HOME/emulator

############################ apk (self-contained build) ############################
FROM toolchain AS apk
COPY --chown=dev:dev package.json package-lock.json ./
RUN --mount=type=cache,target=/home/dev/.npm,uid=1000 npm ci
COPY --chown=dev:dev . .
RUN --mount=type=cache,target=/home/dev/.gradle,uid=1000 ./scripts/android-build.sh debug

FROM scratch AS apk-export
COPY --from=apk /app/dist/android/ /

import { type Routes } from '@angular/router';

/** Every screen is lazy-loaded: the first paint only ships the receipts list. */
export const routes: Routes = [
  { path: '', redirectTo: 'receipts', pathMatch: 'full' },
  {
    path: 'receipts',
    loadComponent: () =>
      import('./presentation/receipts/list/receipts-list.page').then((m) => m.ReceiptsListPage),
  },
  {
    path: 'receipts/select',
    loadComponent: () =>
      import('./presentation/receipts/select/select-receipts.page').then(
        (m) => m.SelectReceiptsPage,
      ),
  },
  {
    path: 'receipts/summary',
    loadComponent: () =>
      import('./presentation/receipts/summary/summary.page').then((m) => m.SummaryPage),
  },
  {
    path: 'receipts/:id',
    loadComponent: () =>
      import('./presentation/receipts/detail/receipt-detail.page').then((m) => m.ReceiptDetailPage),
  },
  {
    path: 'receipts/:id/edit',
    loadComponent: () =>
      import('./presentation/receipts/edit/receipt-edit.page').then((m) => m.ReceiptEditPage),
  },
  {
    path: 'scan/processing',
    loadComponent: () =>
      import('./presentation/scan/processing/scan-processing.page').then(
        (m) => m.ScanProcessingPage,
      ),
  },
  {
    path: 'scan/review',
    loadComponent: () =>
      import('./presentation/scan/review/scan-review.page').then((m) => m.ScanReviewPage),
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./presentation/categories/manage/manage-categories.page').then(
        (m) => m.ManageCategoriesPage,
      ),
  },
  {
    path: 'export',
    loadComponent: () => import('./presentation/reporting/export.page').then((m) => m.ExportPage),
  },
  {
    path: 'backup',
    loadComponent: () => import('./presentation/backup/backup.page').then((m) => m.BackupPage),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./presentation/settings/settings.page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'receipts' },
];

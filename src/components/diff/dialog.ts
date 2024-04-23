import { Dialog, showDialog } from '@jupyterlab/apputils';
import { MergeWidget } from './merge-widget';

export function showDiffDialog(value: string, other: string, title: string) {
  if (value === '' && other === '') {
    console.debug('no output');
    return;
  }
  showDialog({
    title,
    body: new MergeWidget(value, other),
    buttons: [Dialog.cancelButton({ label: 'Close' })]
  });
}

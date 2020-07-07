import { Component, Input } from '@angular/core';
import { NbWindowRef } from '@nebular/theme';

@Component({
  template: `
    <ngx-canvas-parking-image
      *ngIf="rowData"
      [rowData]="rowData"
      [value]="value"
      (click)="closeModalWindow()"
    ></ngx-canvas-parking-image>
  `
})
export class ImageModalComponent {
  @Input() value: string | number;
  @Input() rowData: any;

  constructor(protected windowRef: NbWindowRef) {}

  closeModalWindow() {
    this.windowRef.close();
  }
}

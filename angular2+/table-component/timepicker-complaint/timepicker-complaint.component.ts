import { Component, EventEmitter, Output } from '@angular/core';
import { ChangeContext, Options } from 'ng5-slider';

@Component({
  selector: 'ngx-timepicker-complaint',
  template: `
    <div class="custom-slider">
      <ng5-slider
        [(value)]="value"
        [(highValue)]="highValue"
        [options]="options"
        (userChangeEnd)="onUserChangeEnd($event)"
      ></ng5-slider>
    </div>
  `
})
export class TimepickerComplaintComponent {
  @Output() getPeriodTime = new EventEmitter();
  value: number = 0;
  highValue: number = 24;
  options: Options = {
    floor: 0,
    ceil: 24,
    step: 1,
    showTicks: true,
    minRange: 1,
    translate: (value: number): string => {
      return value.toString().padStart(2, '0');
    }
  };
  onUserChangeEnd(changeContext: ChangeContext): void {
    this.getPeriodTime.emit(changeContext);
  }
}

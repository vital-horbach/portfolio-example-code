import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
  selector: 'ngx-map-element',
  templateUrl: './map-element.component.html'
})
export class MapElementComponent implements ViewCell, OnInit {
  @Input() value: string | number; // This hold the cell value
  @Input() rowData: any; // This holds the entire row object
  //
  mapArray = [];
  drawSpotsJSON = [];

  ngOnInit(): void {
    this.mapArray = this.rowData.drawSpotsJSON.map.map(el => {
      el.polygon.push(el.polygon[0]);
      return el;
    });
    this.drawSpotsJSON = this.rowData.drawSpotsJSON;
    this.drawSpotsJSON = this.mapArray;
  }
}

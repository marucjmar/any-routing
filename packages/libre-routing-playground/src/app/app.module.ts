import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';
// import { LeafletComponent } from './leaflet/leaflet.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, RouterModule.forRoot([], { initialNavigation: 'enabledBlocking' })],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}

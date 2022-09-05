import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { en_US, NZ_I18N } from 'ng-zorro-antd/i18n';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { IconsProviderModule } from './icons-provider.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		HttpClientModule,
		IconsProviderModule,
		NzLayoutModule,
		NzMenuModule,
		NzButtonModule,
		NzDividerModule,
		NzInputModule,
		NzTabsModule,
		NzSpinModule,
	],
	exports: [
		CommonModule,
		FormsModule,
		HttpClientModule,
		IconsProviderModule,
		NzLayoutModule,
		NzMenuModule,
		NzButtonModule,
		NzDividerModule,
		NzInputModule,
		NzTabsModule,
		NzSpinModule,
	],
	providers: [{ provide: NZ_I18N, useValue: en_US }],
})
export class SharedModule {}

import { InjectionToken, Type } from '@angular/core';

export const TINYSLICE_EFFECT_SERVICES = new InjectionToken<Type<unknown>[]>(
	'TINYSLICE_EFFECT_SERVICES'
);

export const TINYSLICE_ROOT_MODULE_INDICATOR_TOKEN = new InjectionToken<boolean>(
	'TINYSLICE_ROOT_MODULE_INDICATOR_TOKEN'
);

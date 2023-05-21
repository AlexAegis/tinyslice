import { InjectionToken } from '@angular/core';
import type { RootSlice } from '@tinyslice/core';

export const ROOT_STORE = new InjectionToken<RootSlice<unknown>>('ROOT_STORE');

import { common } from './common';
import { tasks } from './tasks';
import { detail } from './detail';
import { admin } from './admin';
import { settings } from './settings';

/** key -> [English, বাংলা] */
export const DICT: Record<string, [string, string]> = { ...common, ...tasks, ...detail, ...admin, ...settings };

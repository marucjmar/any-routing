import { expose } from 'comlink';
import { MapboxExecutor } from './mapbox.executor';

expose(new MapboxExecutor());

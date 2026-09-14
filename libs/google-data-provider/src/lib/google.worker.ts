import { expose } from 'comlink';
import { GoogleExecutor } from './google.executor';

expose(new GoogleExecutor());

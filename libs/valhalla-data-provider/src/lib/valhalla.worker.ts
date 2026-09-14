import { expose } from 'comlink';
import { ValhallaExecutor } from './valhalla.executor';

expose(new ValhallaExecutor());

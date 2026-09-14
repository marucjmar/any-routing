import { expose } from 'comlink';
import { HereExecutor } from './here.executor';

const executor = new HereExecutor();

expose(executor);

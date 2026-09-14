import { expose } from 'comlink';
import { OsrmExecutor } from './osrm.executor';

const executor = new OsrmExecutor();

expose(executor);

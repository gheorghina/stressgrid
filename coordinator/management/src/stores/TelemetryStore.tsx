import * as _ from 'lodash';
import { action, computed, observable } from 'mobx';

export class TelemetryStore {
  @observable public lastScriptError: string | null = null;
  @observable public lastErrors: Map<string, number[]> | null = null;
  @observable public recentCpu: number[] = [];
  @observable public recentNetworkRx: number[] = [];
  @observable public recentNetworkTx: number[] = [];
  @observable public recentActiveCount: number[] = [];
  @observable public recentGeneratorCount: number[] = [];
  @observable public desiredSize: number = 10000;

  @action public clear = () => {
    this.recentCpu = [];
    this.recentNetworkRx = [];
    this.recentNetworkTx = [];
    this.recentActiveCount = [];
    this.recentGeneratorCount = [];
  }

  @action public update = (lastScriptError: string | null, lastErrors: Map<string, number[]> | null, recentCpu: number[], recentNetworkRx: number[], recentNetworkTx: number[], recentActiveCount: number[], recentGeneratorCount: number[]) => {
    this.lastScriptError = lastScriptError;
    this.lastErrors = lastErrors;
    this.recentCpu = recentCpu;
    this.recentNetworkRx = recentNetworkRx;
    this.recentNetworkTx = recentNetworkTx;
    this.recentActiveCount = recentActiveCount;
    this.recentGeneratorCount = recentGeneratorCount;
  }

  @computed get cpu() {
    return _.defaultTo(this.recentCpu[0], 0.0);
  }

  @computed get networkRx() {
    return _.defaultTo(this.recentNetworkRx[0], 0);
  }

  @computed get networkTx() {
    return _.defaultTo(this.recentNetworkTx[0], 0);
  }

  @computed get activeCount() {
    return _.defaultTo(this.recentActiveCount[0], 0);
  }

  @computed get generatorCount() {
    return _.defaultTo(this.recentGeneratorCount[0], 0);
  }

  @computed get rampStepSize() {
    return this.generatorCount * 10;
  }

  @computed get rampSteps() {
    return Math.trunc(this.desiredSize / this.rampStepSize);
  }

  @computed get size() {
    return this.rampSteps * this.rampStepSize
  }
}

const store = new TelemetryStore();
export default store;
/*
 * SPDX-License-Identifier: Apache-2.0
 */
import { Object, Property } from 'fabric-contract-api';

// use an interface to share the definition with client code
export interface IChangeColorEvent {
  docType: string;
  carNumber: string;
  previousColor: string;
  newColor: string;
  transactionDate: Date;
}

@Object()
export class ChangeColorEvent implements IChangeColorEvent {
  @Property()
  public docType: string;

  @Property()
  public carNumber: string;

  @Property()
  public previousColor: string;

  @Property()
  public newColor: string;

  // @Property()
  public transactionDate: Date;

  public constructor(carNumber: string, previousColor: string, newColor: string, txDate: Date) {
    this.docType = 'changeColorEvent';
    this.carNumber = carNumber;
    this.previousColor = previousColor;
    this.newColor = newColor;
    this.transactionDate = txDate;
  }

}

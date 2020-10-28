/*
 * SPDX-License-Identifier: Apache-2.0
 */
import { Object, Property } from 'fabric-contract-api';

// use an interface to share the definition with client code
export interface ICreateCarEvent {
  docType: string;
  carNumber: string;
  newOwner: string;
  transactionDate: Date;
}

@Object()
export class CreateCarEvent implements ICreateCarEvent {
  @Property()
  public docType: string;

  @Property()
  public carNumber: string;

  @Property()
  public newOwner: string;

  // @Property()
  public transactionDate: Date;

  public constructor(carNumber: string, newOwner: string, txDate: Date) {
    this.docType = 'createCarEvent';
    this.carNumber = carNumber;
    this.newOwner = newOwner;
    this.transactionDate = txDate;
  }

}

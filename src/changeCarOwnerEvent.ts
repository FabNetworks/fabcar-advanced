/*
 * SPDX-License-Identifier: Apache-2.0
 */
import { Object, Property } from 'fabric-contract-api';

// use an interface to share the definition with client code
export interface IChangeOwnerEvent {
  docType: string;
  carNumber: string;
  previousOwner: string;
  newOwner: string;
  transactionDate: Date;
}

@Object()
export class ChangeOwnerEvent implements IChangeOwnerEvent {
  @Property()
  public docType: string;

  @Property()
  public carNumber: string;

  @Property()
  public previousOwner: string;

  @Property()
  public newOwner: string;

  // @Property()
  public transactionDate: Date;

  public constructor(carNumber: string, previousOwner: string, newOwner: string, txDate: Date) {
    this.docType = 'changeOwnerEvent';
    this.carNumber = carNumber;
    this.previousOwner = previousOwner;
    this.newOwner = newOwner;
    this.transactionDate = txDate;
  }

}

/*
 * SPDX-License-Identifier: Apache-2.0
 */
import { Object, Property } from 'fabric-contract-api';

// use an interface to share the definition with client code
export interface IDeleteCarEvent {
  docType: string;
  carNumber: string;
  previousOwner: string; // the one who owned the car when it was deleted
  transactionDate: Date;
}

@Object()
export class DeleteCarEvent implements IDeleteCarEvent {
  @Property()
  public docType: string;

  @Property()
  public carNumber: string;

  @Property()
  public previousOwner: string;

  // @Property()
  public transactionDate: Date;

  public constructor(carNumber: string, previousOwner: string, txDate: Date) {
    this.docType = 'deleteCarEvent';
    this.carNumber = carNumber;
    this.previousOwner = previousOwner;
    this.transactionDate = txDate;
  }

}

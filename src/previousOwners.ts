/*
 * SPDX-License-Identifier: Apache-2.0
 */
import { Object, Property } from 'fabric-contract-api';
import { Timestamp } from 'google-protobuf/google/protobuf/timestamp_pb';

@Object()
export class PreviousOwnersResult {

  @Property()
  public previousOwnerCount: number;

  // @Property()
  public previousOwners?: string[];

  // Property()
  public previousOwnershipChangeDates?: Date[];

  @Property()
  public currentOwner: string;

  // @Property()
  public currentOwnershipChangeDate: Date;

  public constructor(count: number, previousOwners: string[], previousOwnershipChangeDates: Date[], currentOwner: string, currentDate: Date) {
    this.previousOwnerCount = count;
    if (count > 0) {
      this.previousOwners = previousOwners;
      this.previousOwnershipChangeDates = previousOwnershipChangeDates;
    }
    this.currentOwner = currentOwner;
    this.currentOwnershipChangeDate = currentDate;
  }
}

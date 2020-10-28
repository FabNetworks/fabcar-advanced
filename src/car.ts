/*
 * SPDX-License-Identifier: Apache-2.0
 */
import { Object, Property } from 'fabric-contract-api';
@Object()
export class Car {

  @Property()
  public docType?: string;

  @Property()
  public color: string = '';

  @Property()
  public make: string = '';

  @Property()
  public model: string = '';

  @Property()
  public owner: string = '';

  @Property()
  public certOwner?: string;
}

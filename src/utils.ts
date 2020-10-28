/*
 * SPDX-License-Identifier: Apache-2.0
 */
import { Iterators, ClientIdentity } from 'fabric-shim';
import { Car } from './car';
import { Context } from 'fabric-contract-api';

export class Utils {
  public static verifyCarKey(carNumber: string) {

    // Simple rules for car IDs.

    // Of course, we could have just used a regex for all of this but then
    // we can't easily give useful error messages back the user :-)

    // 1: No leading or trailing whitespace
    const initialLength = carNumber.length;
    carNumber = carNumber.trim();
    if (initialLength !== carNumber.length) {
      throw new Error(`The car ID ${carNumber} must not have leading or trailing whitespace.`);
    }

    // 2: ID must begin with the letters CAR
    if (!carNumber.startsWith('CAR')) {
      throw new Error(`The car ID ${carNumber} must start with 'CAR'.`);
    }

    // 3: ID must contain an ID after the letters CAR
    if (carNumber.length < 4) {
      throw new Error(`The car ID ${carNumber} is too short. The min car ID is CAR0.`);
    }

    // 4: ID must not be longer than CAR9999
    if (carNumber.length > 7) {
      throw new Error(`The car ID ${carNumber} is too long. The max car ID is CAR9999.`);
    }

    // 5: ID must not have leading zeros after CAR (but allow a CAR0 !)
    const carID = carNumber.slice(3);
    if (carID[0] === '0' && carID.length > 1) {
      throw new Error(`The car ID ${carNumber} cannot have leading zeros.`);
    }

    // 6: ID must be numeric
    const isnum = /^\d+$/.test(carID);
    if (!isnum) {
      throw new Error(`The car ID ${carNumber} must be numeric.`);
    }

  }

  public static extractCN(certId: string | undefined): string {
    // certID looks like this:
    // x509::/OU=client/CN=mgk-peer-id::/C=US/ST=California/L=San Francisco/O=Internet Widgets, Inc./OU=WWW/CN=example.com
    // or
    // x509::/C=US/ST=North Carolina/O=Hyperledger/OU=client/CN=org1Admin::/C=US/ST=California/L=San Francisco/O=Internet Widgets, Inc./OU=WWW/CN=example.com
    // We need to extract mgk-peer-id from the first example and org1Admin from the second

    // make sure we have a valid string to start with
    let cn = '';

    // allow undefined for now
    if (certId === undefined) {
      return cn;
    }

    if (!certId.startsWith('x509::')) {
      return cn;
    }

    // split into individual parts (should be at least 2)
    const items = certId.split('::');
    if (items.length < 1) {
      return cn;
    }

    // we ignore the first item which is 'x509'
    // this relies on the CN= being the last item - which it has always been so far :-)
    const index = items[1].indexOf('CN=');
    if (index > 0) {
      cn = items[1].slice(index + 3);
    }
    return cn;
  }

  public static replaceCN(certId: string, newCN: string | undefined): string {
    // first get the CN to replace
    const currentCN = Utils.extractCN(certId);

    if (currentCN.length === 0) {
      return certId; // should not happen
    }

    // add back in the 'CN=' to make sure we only replace the CN at the right place
    const newCertId = certId.replace('CN=' + currentCN, 'CN=' + newCN);
    return newCertId;
  }

  public static async processQueryResults(outputAll: boolean, iterator: Iterators.StateQueryIterator): Promise<object[]> {
    const allResults: object[] = [];
    while (true) {
      const result = await iterator.next();

      if (result.value) {
        // console.log(res.value.value.toString('utf8'));

        const key = result.value.key;
        let car: Car;
        try {
          car = JSON.parse(result.value.value.toString('utf8')) as Car;
          if (!outputAll) {
            car.certOwner = undefined; // remove before returning to user
          }
        } catch (err) {
          console.log(err);
          // car = result.value.value.toString('utf8');
          throw new Error(`The car ${key} has an invalid JSON record ${result.value.value.toString('utf8')}.`);
        }
        allResults.push({ key, car });
      }

      if (result.done) {
        // console.log('end of data');
        await iterator.close();
        console.info(allResults);
        return allResults;
      }
    }
  }

  public static async checkForMaxCars(carNumber: string, clientCertId: string, cid: ClientIdentity, ctx: Context, transferCheck: boolean = false): Promise<boolean> {
    // Limit the total cars a single user can create to maxCars.
    // As we have to search to find cars owned by the current caller,
    // we construct the query to return the minimum data - not actual cars
    const maxCars = 20; // todo make configurable elsewhere
    const query = {
      fields: ['_id'],
      selector: {
        certOwner: clientCertId,
        docType: 'car',
      },
      use_index: [
        '_design/indexCertOwnerDoc',
        'indexCertOwner',
      ],
    };

    const iter = await ctx.stub.getQueryResult(JSON.stringify(query));
    let carCount = 0;
    while (true) {
      // count results only - ignore contents
      const res = await iter.next();
      if (res.value) { ++carCount; }
      if (res.done) { await iter.close(); break; }
    }

    if (carCount >= maxCars) {
      const msp = cid.getMSPID();
      if (msp !== 'IBMMSP') {
        const clientCN = Utils.extractCN(clientCertId);
        if(transferCheck) {
          throw new Error(`The car transfer of car ${carNumber} cannot be accepted. User ${clientCN} is not authorised to own more than ${maxCars} cars.`);
        } else {
          throw new Error(`The car ${carNumber} cannot be created. User ${clientCN} is not authorised to create or own more than ${maxCars} cars.`);
        }
      }
    }

    return true;
  }
}

/*
 * SPDX-License-Identifier: Apache-2.0
 */
import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';
import { ClientIdentity, Iterators } from 'fabric-shim';
import { Car } from './car';
import { ChangeOwnerEvent } from './changeCarOwnerEvent';
import { ChangeColorEvent } from './changeCarColorEvent';
import { CreateCarEvent } from './createCarEvent';
import { DeleteCarEvent } from './deleteCarEvent';
import { PreviousOwnersResult } from './previousOwners';
import { TimestampMapper } from './timestamp';
import { Utils } from './utils';

@Info({ title: 'FabCar', description: 'FabCar Smart Contract' })
export class FabCar extends Contract
{

  // @Transaction(false)
  public async initLedger(ctx: Context)
  {
    console.info('============= START : Initialize Ledger ===========');

    // get our ID to stamp into the car
    const cid = new ClientIdentity(ctx.stub);
    const clientCertId = cid.getID();

    const cars: Car[] = [
      {
        color: 'blue',
        make: 'Toyota',
        model: 'Prius',
        owner: 'Tomoko',
      },
      {
        color: 'red',
        make: 'Ford',
        model: 'Mustang',
        owner: 'Brad',
      },
      {
        color: 'green',
        make: 'Hyundai',
        model: 'Tucson',
        owner: 'Jin Soo',
      },
      {
        color: 'yellow',
        make: 'Volkswagen',
        model: 'Passat',
        owner: 'Max',
      },
      {
        color: 'black',
        make: 'Tesla',
        model: 'S',
        owner: 'Adriana',
      },
      {
        color: 'purple',
        make: 'Peugeot',
        model: '205',
        owner: 'Michel',
      },
      {
        color: 'white',
        make: 'Chery',
        model: 'S22L',
        owner: 'Aarav',
      },
      {
        color: 'violet',
        make: 'Fiat',
        model: 'Punto',
        owner: 'Pari',
      },
      {
        color: 'indigo',
        make: 'Tata',
        model: 'Nano',
        owner: 'Valeria',
      },
      {
        color: 'brown',
        make: 'Holden',
        model: 'Barina',
        owner: 'Shotaro',
      },
    ];

    for (let i = 0; i < cars.length; i++) {
      cars[i].docType = 'car';
      cars[i].certOwner = clientCertId;
      await ctx.stub.putState('CAR' + i, Buffer.from(JSON.stringify(cars[i])));
      console.info('Added <--> ', cars[i]);
    }
    console.info('============= END : Initialize Ledger ===========');
  }

  @Transaction(false)
  @Returns('boolean')
  public async carExists(ctx: Context, carNumber: string): Promise<boolean>
  {

    // make sure the carNumber is valid before trying to get it
    Utils.verifyCarKey(carNumber);

    const buffer = await ctx.stub.getState(carNumber);
    return (!!buffer && buffer.length > 0);
  }

  @Transaction()
  @Returns('Car')
  public async queryCar(ctx: Context, carNumber: string): Promise<Car>
  {

    const exists = await this.carExists(ctx, carNumber);
    if (!exists) {
      throw new Error(`The car ${carNumber} does not exist.`);
    }

    // Check for a transient option to control output. We allow:
    // [ "QueryOutput": "all" | "normal" (the default) ] Returns certOwner field in the output
    let outputAll = false;
    const transientData = ctx.stub.getTransient();
    if (transientData.has('QueryOutput')) {
      const value = transientData.get('QueryOutput');
      if (value?.toString('utf8') === 'all') {
        outputAll = true;
      }
    }

    const buffer = await ctx.stub.getState(carNumber); // get the car from chaincode state
    const car = JSON.parse(buffer.toString()) as Car;
    if (!outputAll) {
      car.certOwner = undefined; // remove before returning to user
    }
    return car;
  }

  @Transaction()
  @Returns('object[]')
  public async queryByOwner(ctx: Context, carOwner: string): Promise<object[]>
  {

    // Check for transient options to control query and output. We allow:
    // [ "QueryOutput": "all" | "normal" (the default) ] Returns certOwner field in the output
    let outputAll = false;
    const transientData = ctx.stub.getTransient();
    if (transientData.has('QueryOutput')) {
      const value = transientData.get('QueryOutput');
      if (value?.toString('utf8') === 'all') {
        outputAll = true;
      }
    }

    if (!carOwner) {
      throw new Error(`The query cannot be made as the 'carOwner' parameter is empty.`);
    }

    // construct the query we need
    const query = {
      selector: {
        docType: 'car',
        owner: carOwner,
      },
      use_index: [
        '_design/indexOwnerDoc',
        'indexOwner',
      ],
    };

    // console.log('****QUERY: ', query);

    // issue the query
    const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));

    // Now process the query results
    return await Utils.processQueryResults(outputAll, iterator);
  }

  @Transaction()
  @Returns('object[]')
  public async queryAllCars(ctx: Context): Promise<object[]>
  {

    // Check for transient options to control query and output. We allow:
    // 1: [ "QueryOutput": "all" | "normal" (the default) ] Returns certOwner field in the output
    // 2: [ "QueryByOwner": "John" ] Return only those cars owned by "John" or "Max" or whoever
    // 3: [ "QueryByCreator": "true" | "fabric_user_xxxx" ] Returns only cars the caller (or another user) have created and have not transfered
    // 4: [ "QueryOutput": "all", "QueryByOwner": "John", "QueryByCreator": "true" ] Combinations of the above
    let outputAll = false;
    let iterator: Iterators.StateQueryIterator; // undefined
    const transientData = ctx.stub.getTransient();
    const optionsCount = transientData.size;
    if (optionsCount > 0) {
      // store the index and design doc to use
      let queryIndexName = '';
      let queryIndexDesignDocName = '';

      // Get output options
      if (transientData.has('QueryOutput')) {
        const value = transientData.get('QueryOutput');
        if (value?.toString('utf8') === 'all') {
          outputAll = true;
        }

        // set up the correct index to use in the search
        queryIndexName = 'indexDocType';
        queryIndexDesignDocName = '_design/indexDocTypeDoc';
      }

      const selector: any = {};
      // Process queryByOwner options
      if (transientData.has('QueryByOwner')) {
        let queryByOwner = '';
        const value = transientData.get('QueryByOwner');
        if (value) {
          queryByOwner = value.toString('utf8');
        }

        // set up the correct index to use in the search
        queryIndexName = 'indexOwner';
        queryIndexDesignDocName = '_design/indexOwnerDoc';

        // set up the correct selector to use in the search
        selector.owner = queryByOwner;
      }

      // Process query by Creator options
      // Note: if owner and certOwner are chosen it will work but will
      // slow down the search as we do not index for owner AND certOwner together
      if (transientData.has('QueryByCreator')) {
        const value = transientData.get('QueryByCreator');
        const creatorId = value?.toString('utf8');

        // get our ID to queryBy or use as a template
        const cid = new ClientIdentity(ctx.stub);
        const clientCertId = cid.getID();

        // true means use current callers ID
        let queryByCreatorId = '';
        if (creatorId === 'true') {
          queryByCreatorId = clientCertId;
        } else if (creatorId?.startsWith('x509::/')) {
          // explicit string used, use this verbatim
          queryByCreatorId = creatorId;
        } else {
          // Replace current caller CN with the provided one. This only works
          // for cars that are created under the using the same CA as the caller.
          queryByCreatorId = Utils.replaceCN(clientCertId, creatorId);
        }

        // set up the correct index to use in the search
        queryIndexName = 'indexCertOwner';
        queryIndexDesignDocName = '_design/indexCertOwnerDoc';

        // set up the correct selector to use in the search
        selector.certOwner = queryByCreatorId;
      }

      // construct the query
      selector.docType = 'car';
      const query = {
        selector,
        use_index: [
          queryIndexDesignDocName,
          queryIndexName,
        ],
      };
      // console.log('****QUERY: ', query);

      // finally issue the query
      iterator = await ctx.stub.getQueryResult(JSON.stringify(query));

    } else {
      // process a simple range query instead
      const startKey = 'CAR0';
      const endKey = 'CAR9999';

      // issue the query
      iterator = await ctx.stub.getStateByRange(startKey, endKey);
    }

    // Now process the query results
    return await Utils.processQueryResults(outputAll, iterator);
  }

  @Transaction()
  @Returns('object[]')
  public async findMyCars(ctx: Context): Promise<object[]>
  {

    // Check for transient options to control query and output. We allow:
    // [ "QueryOutput": "all" | "normal" (the default) ] Returns certOwner field in the output
    let outputAll = false;
    const transientData = ctx.stub.getTransient();
    if (transientData.has('QueryOutput')) {
      const value = transientData.get('QueryOutput');
      if (value?.toString('utf8') === 'all') {
        outputAll = true;
      }
    }

    // get our ID to stamp into the car
    const cid = new ClientIdentity(ctx.stub);
    const clientCertId = cid.getID();

    // construct the query we need
    const query = {
      selector: {
        certOwner: clientCertId,
        docType: 'car',
      },
      use_index: [
        '_design/indexCertOwnerDoc',
        'indexCertOwner',
      ],
    };

    // console.log('****QUERY: ', query);

    // issue the query
    const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));

    // Now process the query results
    return await Utils.processQueryResults(outputAll, iterator);
  }

  @Transaction()
  public async createCar(ctx: Context, carNumber: string, make: string, model: string, color: string, owner: string)
  {
    console.info('============= START : Create Car ===========');

    const exists = await this.carExists(ctx, carNumber);
    if (exists) {
      throw new Error(`The car ${carNumber} already exists.`);
    }

    // get our ID to stamp into the car
    const cid = new ClientIdentity(ctx.stub);
    const clientCertId = cid.getID();

    // Special case CAR10 as it's a reserved slot for IBM Org.
    // So are CAR0 - CAR9, but because initLedger created those cars, they will already exist...
    if (carNumber === 'CAR10') {
      const msp = cid.getMSPID();
      if (msp !== 'IBMMSP') {
        const clientCN = Utils.extractCN(clientCertId);
        throw new Error(`The car ${carNumber} cannot be created. User ${clientCN} not authorised to create a car with reserved ID 'CAR10'. Try a different car number.`);
      }
    }

    // Check to see if we have reached the limit on the total number of cars a single user can create or own
    await Utils.checkForMaxCars(carNumber, clientCertId, cid, ctx); // this will throw if not ok

    if (!make) {
      throw new Error(`The car ${carNumber} cannot be created as the 'make' parameter is empty.`);
    }

    if (!model) {
      throw new Error(`The car ${carNumber} cannot be created as the 'model' parameter is empty.`);
    }

    if (!color) {
      throw new Error(`The car ${carNumber} cannot be created as the 'color' parameter is empty.`);
    }

    if (!owner) {
      throw new Error(`The car ${carNumber} cannot be created as the 'owner' parameter is empty.`);
    }

    const car: Car = {
      certOwner: clientCertId,
      color,
      docType: 'car',
      make,
      model,
      owner,
    };

    const buffer = Buffer.from(JSON.stringify(car));
    await ctx.stub.putState(carNumber, buffer);

    // emit an event to inform listeners that a car has been created
    const txDate = TimestampMapper.toDate(ctx.stub.getTxTimestamp());
    const createCarEvent = new CreateCarEvent(carNumber, owner, txDate);
    ctx.stub.setEvent(createCarEvent.docType, Buffer.from(JSON.stringify(createCarEvent)));

    console.info('============= END : Create Car ===========');
  }

  @Transaction()
  public async deleteCar(ctx: Context, carNumber: string)
  {
    console.info('============= START : Delete Car ===========');

    const exists = await this.carExists(ctx, carNumber);
    if (!exists) {
      throw new Error(`The car ${carNumber} does not exist.`);
    }

    // get the car we want to modify and the current certOwner from it
    const buffer = await ctx.stub.getState(carNumber); // get the car from chaincode state
    const car = JSON.parse(buffer.toString()) as Car;
    const carCertId = car.certOwner;
    const currentOwner = car.owner;

    // get the client ID so we can make sure they are allowed to modify the car
    const cid = new ClientIdentity(ctx.stub);
    const clientCertId = cid.getID();

    // The rule is to be able to delete a car you must be the current certOwner for it
    // which usually means you are the creater of it or have had it transfered to your FabricUserID (CN)
    // Note we allow underfined for now as we may be deployed on an older ledger which did not put clientCertId into cars...
    if (carCertId !== undefined) {
      if (carCertId !== clientCertId) {

        // we are not the certOwner for it, but see if it has been transfered to us via a
        // changeCarOwner() transaction - which means we check our CN against the external current owner
        const clientCN = Utils.extractCN(clientCertId);
        if (clientCN !== car.owner) {
          // special case IBM Org which can delete anything
          const msp = cid.getMSPID();
          if (msp !== 'IBMMSP') {
            const carCN = Utils.extractCN(carCertId);
            throw new Error(`The car ${carNumber} cannot be deleted. User ${clientCN} not authorised to delete car owned by ${carCN}.`);
          }
        }
      }
    }

    await ctx.stub.deleteState(carNumber);

    // emit an event to inform listeners that a car has been deleted
    const txDate = TimestampMapper.toDate(ctx.stub.getTxTimestamp());
    const deleteCarEvent = new DeleteCarEvent(carNumber, currentOwner, txDate);
    ctx.stub.setEvent(deleteCarEvent.docType, Buffer.from(JSON.stringify(deleteCarEvent)));

    console.info('============= END : Delete Car ===========');
  }

  @Transaction()
  public async changeCarOwner(ctx: Context, carNumber: string, newOwner: string)
  {
    console.info('============= START : changeCarOwner ===========');

    const exists = await this.carExists(ctx, carNumber);
    if (!exists) {
      throw new Error(`The car ${carNumber} does not exist.`);
    }

    // get the car we want to modify and the current certOwner from it
    const buffer = await ctx.stub.getState(carNumber); // get the car from chaincode state
    const car = JSON.parse(buffer.toString()) as Car;
    const carCertId = car.certOwner;

    if (!newOwner) {
      throw new Error(`The ownership of car ${carNumber} cannot be changed as the 'newOwner' parameter is empty.`);
    }

    if (car.owner.toLowerCase() === newOwner.toLowerCase()) {
      throw new Error(`The ownership of car ${carNumber} cannot be changed as the current owner '${car.owner}' and the new owner are the same.`);
    }

    // get the client ID so we can make sure they are allowed to modify the car
    const cid = new ClientIdentity(ctx.stub);
    const clientCertId = cid.getID();

    // the rule is to be able to modify a car you must be the current certOwner for it
    // which usually means you are the creater of it or have had it transfered to your FabricUserID (CN)
    if (carCertId !== clientCertId) {

      // we are not the certOwner for it, but see if it has been transfered to us via a
      // changeCarOwner() transaction - which means we check our CN against the current external owner
      const clientCN = Utils.extractCN(clientCertId);
      if (clientCN !== car.owner) {
        // special case IBM Org which can take ownership of anything
        const msp = cid.getMSPID();
        if (msp !== 'IBMMSP') {
          const carCN = Utils.extractCN(carCertId);
          throw new Error(`The ownership of car ${carNumber} cannot be changed. User ${clientCN} not authorised to change a car owned by ${carCN}.`);
        }
      } else {
        // as the car has been transfered to us, we need to take "full" ownership of it
        // this prevents the previous owner deleting it for example. IBM Org does not need to do this!

        // but first make sure we do not already have too many cars
        await Utils.checkForMaxCars(carNumber, clientCertId, cid, ctx, true); // this will throw if not ok
        car.certOwner = clientCertId;
      }
    }

    // set the new owner into the car
    const previousOwner = car.owner;
    car.owner = newOwner;

    // put the car into the RWSET for adding to the ledger
    await ctx.stub.putState(carNumber, Buffer.from(JSON.stringify(car)));

    // emit an event to inform listeners that a car has had its owner changed
    const txDate = TimestampMapper.toDate(ctx.stub.getTxTimestamp());
    const changeOwnerEvent = new ChangeOwnerEvent(carNumber, previousOwner, newOwner, txDate);
    ctx.stub.setEvent(changeOwnerEvent.docType, Buffer.from(JSON.stringify(changeOwnerEvent)));

    console.info('============= END : changeCarOwner ===========');
  }

  @Transaction()
  public async resprayCar(ctx: Context, carNumber: string, newColor: string)
  {
    console.info('============= START : resprayCar ===========');

    const exists = await this.carExists(ctx, carNumber);
    if (!exists) {
      throw new Error(`The car ${carNumber} does not exist.`);
    }


    // get the car we want to modify and the current certOwner from it
    const buffer = await ctx.stub.getState(carNumber); // get the car from chaincode state
    const car = JSON.parse(buffer.toString()) as Car;
    const carCertId = car.certOwner;

    if (!newColor) {
      throw new Error(`The car ${carNumber} cannot be resprayed as the 'newColor' parameter is empty and we are out of invisible paint :-)`);
    }
    
    if (car.color.toLowerCase() === newColor.toLowerCase()) {
      throw new Error(`The color of car ${carNumber} cannot be changed as the current color '${car.color}' and the new color are the same.`);
    }

    // get the client ID so we can make sure they are allowed to modify the car
    const cid = new ClientIdentity(ctx.stub);
    const clientCertId = cid.getID();

    // the rule is to be able to modify a car you must be the current certOwner for it
    // which usually means you are the creater of it or have had it transfered to your FabricUserID (CN)
    if (carCertId !== clientCertId) {

      // we are not the certOwner for it, but see if it has been transfered to us via a
      // changeCarOwner() transaction - which means we check our CN against the current external owner
      const clientCN = Utils.extractCN(clientCertId);
      if (clientCN !== car.owner) {
        // special case IBM Org which can take ownership of anything
        const msp = cid.getMSPID();
        if (msp !== 'IBMMSP') {
          const carCN = Utils.extractCN(carCertId);
          throw new Error(`The color of car ${carNumber} cannot be changed. User ${clientCN} not authorised to change a car owned by ${carCN}.`);
        }
      } else {
        // as the car has been transfered to us, we need to take "full" ownership of it
        // this prevents the previous owner deleting it for example. IBM Org does not need to do this!

        // but first make sure we do not already have too many cars
        await Utils.checkForMaxCars(carNumber, clientCertId, cid, ctx, true); // this will throw if not ok
        car.certOwner = clientCertId;
      }
    }

    // set the new color into the car
    const previousColor = car.color;
    car.color = newColor;

    // put the car into the RWSET for adding to the ledger
    await ctx.stub.putState(carNumber, Buffer.from(JSON.stringify(car)));

    // emit an event to inform listeners that a car has had its color changed
    const txDate = TimestampMapper.toDate(ctx.stub.getTxTimestamp());
    const changecolorEvent = new ChangeColorEvent(carNumber, previousColor, newColor, txDate);
    ctx.stub.setEvent(changecolorEvent.docType, Buffer.from(JSON.stringify(changecolorEvent)));

    console.info('============= END : resprayCar ===========');
  }

  @Transaction()
  @Returns('PreviousOwnersResult')
  public async getPreviousOwners(ctx: Context, carNumber: string): Promise<PreviousOwnersResult>
  {
    console.info('============= START : getPreviousOwners ===========');

    const exists = await this.carExists(ctx, carNumber);
    if (!exists) {
      throw new Error(`The car ${carNumber} does not exist.`);
    }

    // Note: as of fabric 2.0 getHistoryForKey() is guaranteed to return data "newest to oldest" so most recent first
    const historyIterator = await ctx.stub.getHistoryForKey(carNumber);
    const previousOwners: string[] = [];
    const previousOwnershipChangeDates: Date[] = [];
    let previousOwnerCount = 0;
    let previousOwner = '';
    let previousCertOwner = '';
    let currentOwner = '';
    let currentOwnershipChangeDate: Date = new Date();
    let first = true;
    while (true) {
      const res = await historyIterator.next();
      if (res.value) {
        let currentCarOwner = '';
        let currentCarCertOwner = '';
        const txnTs = res.value.getTimestamp();
        const txnDate = TimestampMapper.toDate(txnTs);
        if (res.value.is_delete) {
          currentCarOwner = 'CAR KEY DELETED';
        } else {
          // console.log(res.value.value.toString('utf8'));
          try {
            const car = JSON.parse(res.value.value.toString('utf8')) as Car;
            currentCarOwner = car.owner;
            currentCarCertOwner = car.certOwner ? car.certOwner : ''; // there will always be a certOwner
          } catch (err) {
            // result = 'Invalid JSON';
            console.log(err);
            throw new Error(`The car ${carNumber} has an invalid JSON record ${res.value.value.toString('utf8')}.`);
          }
        }

        if (first) {
          // keep current owner out of previousOwner list and count.
          // this relies on the car existing (so not being a deleted car for current owner)
          // but as we always check that the carExists() first that should not be a problem
          currentOwner = currentCarOwner;
          currentOwnershipChangeDate = txnDate;
          first = false;
        } else {
          let includeTxn = true;
          // bounce over deletes as we keep those in the list...
          if (!res.value.is_delete) {
            // we start checking on the second (and subsequent) time through so we aways have previous details
            if ((previousCertOwner !== currentCarCertOwner && previousOwner === currentCarOwner) ||
              (previousCertOwner === currentCarCertOwner && previousOwner === currentCarOwner)) {
              // this indicates this txn was followed by a ConfirmTransfer txn or was a different type of
              // none ownership transfering txn such as a resprayCar txn which means we keep this one
              // out of the previous owners lists as otherwise it looks like a duplicate transfer happened.
              includeTxn = false;
              console.log('Skipping txn: ', previousOwnerCount, currentCarOwner, txnDate.toString());
            }
          }

          if (includeTxn) {
            ++previousOwnerCount;
            previousOwners.push(currentCarOwner);
            previousOwnershipChangeDates.push(txnDate);
          }
        }

        // store for next iteration
        previousOwner = currentCarOwner;
        previousCertOwner = currentCarCertOwner;
      }
      if (res.done) {
        // console.log('end of data');
        await historyIterator.close();
        break;
      }
    }

    // create the return data
    const allresults = new PreviousOwnersResult(
      previousOwnerCount,
      previousOwners,
      previousOwnershipChangeDates,
      currentOwner,
      currentOwnershipChangeDate,
    );

    console.info('============= END : getPreviousOwners ===========');
    return allresults;
  }

  @Transaction()
  public async confirmTransfer(ctx: Context, carNumber: string): Promise<boolean>
  {
    console.info('============= START : confirmTransfer ===========');

    const exists = await this.carExists(ctx, carNumber);
    if (!exists) {
      throw new Error(`The car ${carNumber} does not exist.`);
    }

    // get the car we want to modify and the current certOwner from it
    const buffer = await ctx.stub.getState(carNumber); // get the car from chaincode state
    const car = JSON.parse(buffer.toString()) as Car;
    const carCertId = car.certOwner;

    // get the client ID so we can make sure they are allowed to modify the car
    const cid = new ClientIdentity(ctx.stub);
    const clientCertId = cid.getID();

    // the rule is to be able to modify a car you must be the current certOwner for it
    // which usually means you are the creater of it or have had it transfered to your FabricUserID (CN)
    // However, here we are bypassing this so we want to make sure that our clientID is NOT sure certOwner,
    // but that our clientCN IS the external owner
    if (carCertId === clientCertId) {
      // no transfer takes place - we are already the owner
      return false;
    }

    // we are not the certOwner for it (good), but make sure it has been transfered to us via a
    // changeCarOwner() transaction - which means we check our CN against the current external owner
    const clientCN = Utils.extractCN(clientCertId);
    if (clientCN === car.owner) {
      // make sure we do not already have too many cars - transferCheck
      await Utils.checkForMaxCars(carNumber, clientCertId, cid, ctx, true); // this will throw if not ok

      // as the car has been transfered to us, we need to take "full" ownership of it
      // this prevents the previous owner deleting it for example.
      car.certOwner = clientCertId;
    } else {
      // not transfered to us
      const carCN = Utils.extractCN(carCertId);
      throw new Error(`The ownership of car ${carNumber} cannot be changed. User ${carCN} has not authorised ${clientCN} to take ownership.`);
    }

    await ctx.stub.putState(carNumber, Buffer.from(JSON.stringify(car)));

    console.info('============= END : confirmTransfer ===========');
    return true;
  }
}

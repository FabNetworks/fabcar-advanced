# fabcar-advanced

Fabcar-advanced contains the implementation of a smart contract that showcases various features of [Hyperledger Fabric](https://www.hyperledger.org/use/fabric).
It is loosely based on the [sample of the same name](https://github.com/hyperledger/fabric-samples/blob/master/chaincode/fabcar/typescript/src/fabcar.ts), but contains several additional transactions and checks to allow it to be run in a shared environment.

The smart contract is intended for use by the [drivenet network](https://fabnetworks.org/networks/DriveNet) which is listed on the network registry hosted at [fabnetworks.org](https://fabnetworks.org), and demonstrated by the *Joining a Network* tutorials that form part of the [IBM Blockchain Platform VS Code extension](https://marketplace.visualstudio.com/items?itemName=IBMBlockchain.ibm-blockchain-platform). It is recommended that you follow these tutorials to find out how this contract is used.

The smart contract is written in Typescript and compatible with Hyperledger Fabric 1.4 and above. The entry point can be found in [src/fabcar.ts](./src/fabcar.ts).

Fabcar-advanced is under active development and the team welcomes your feedback. If you have any questions, comments or suggestions for future features please create [issues and suggestions on Github](https://github.com/m-g-k/fabcar-advanced/issues). For any questions please [create a question on Stack Overflow](http://ibm.biz/fabnetso).

This package uses the Apache-2.0 license.

## Transactions

If you are not familiar the [basic fabcar smart contract](https://github.com/hyperledger/fabric-samples/blob/master/chaincode/fabcar/typescript/src/fabcar.ts), it's worthwhile reviewing it. The version in this repo has a few minor changes, but it's conceptually the same; the world state consists of a set of key/value pairs that describe properties of car assets:
* Each **key** is of the form 'CAR*n*', where *n* is a integer from 0 to 9999, with no padding of leading zeroes.
* Each **value** is a JSON data structure that contains four unparsed strings that describe the make, model, color and owner of the car.

We'll now look at the available transactions that manipulate the records in the world state, starting with the ones that are in the original contract.

To better understand the expected input and output formats, it's recommended to follow the previously mentioned tutorials.

### Enhanced transactions

The basic fabcar transactions have been retained in the advanced version. However, additional checks have been implemented to several of them to help prevent misuse in a shared environment; see the Policies section below for details.

* **createCar**: Adds a new car record to the world state. Input takes the form *[\<id\>,\<make\>,\<model\>,\<color\>,\<owner\>]*; there is no output data structure.

    *Input*: `["CAR500","Arium","Thanos","purple","Felicity"]`<br>
    *Output*: none

* **queryCar**: Returns the details of a car record in the world state. Input takes the form *[\<id\>]*; output contains the car details:

    *Input*: `["CAR500"]`<br>
    *Output*: `{"color":"purple","docType":"car","make":"Arium","model":"Thanos","owner":"Felicity"}`

* **queryAllCars**: Returns the details of all car records in the world state that conform to the correct key specification (CAR*n*). Input takes no parameters; output is an array of car details.

    *Input*: none<br>
    *Output*: `[{"key":"CAR0","car":{"color":"blue","docType":"car","make":"Toyota","model":"Prius","owner":"Tomoko"}},{"key":"CAR1"` ...

* **changeCarOwner**: Modifies the owner of a previously created car. Input takes the form *[\<id\>,\<owner\>]*; there is no output data structure.

    *Input*: `["CAR500","Beau"]`<br>
    *Output*: none


### New transactions

The following transactions are not in the basic version of fabcar:

* **getPreviousOwners**: Shows the ownership history of a car, excluding the current owner. Input takes the form *[\<id\>]*; output includes the number of owners, the array of owner names, the dates the changes happened and details of the current owner.

    *Input*: `["CAR500"]`<br>
    *Output*: `{"previousOwnerCount":3,"previousOwners":["random_135","random_780","random_902"],"previousOwnershipChangeDates":["2020-09-10T12:34:09.197Z","2020-09-09T09:18:06.065Z","2020-09-09T09:17:32.394Z"],"currentOwner":"Matt","currentOwnershipChangeDate":"2020-08-28T15:14:56.344Z"}`

* **deleteCar**: Removes a car from the world state. The history is retained if the car is later restored. Input takes the form *[\<id\>]*; there is no output data structure.

    *Input*: `["CAR500"]`<br>
    *Output*: none

* **confirmTransfer**: Accepts ownership of a car that another registered user wants to send to you. Input takes the form *[\<id\>]*; there is no output data structure.

    *Input*: `["CAR500"]`<br>
    *Output*: none

* **findMyCars**: Returns all car records that are currently assigned to you as the *certOwner*. Input takes no parameters; output is an array of car details.

    *Input*: none<br>
    *Output*: `[{"key":"CAR500","car":{"color":"purple","docType":"car","make":"Arium","model":"Thanos","owner":"Felicity"}},{"key":"CAR501"` ...

* **queryByOwner**: Returns all car records that have the supplied *owner* field. Input takes the form *[\<owner\>]*; output is an array of car details.

    *Input*: `["Felicity"]`<br>
    *Output*: `[{"key":"CAR500","car":{"color":"purple","docType":"car","make":"Arium","model":"Thanos","owner":"Felicity"}},{"key":"CAR501"` ...

* **carExists**: Returns true if and only if the car with the supplied key exists in the world state. Input takes the form *[\<id\>]*; output is "true" or "false".

    *Input*: `["CAR500"]`<br>
    *Output*: `true`


### Controlling output

Use the transient data field to customise the output of the query transactions (queryCar, queryByOwner, queryAllCars and findMyCars):

* Set the value of the "QueryOutput" key to "all" to include the *certOwner* field in the output, or "normal" to hide it. Default is "normal". Example: ```[ "QueryOutput": "all" ] ```
* Set the value of the "QueryByCreator" key to the name of a *certOwner* to search for all the vehicles with a certOwner of the supplied value.

## Policies

Transactions in the advanced fabcar smart contract include a number of checks to prevent misuse of the network in a shared environment. Examples of checks that are performed are:

* Car IDs must be in the range CAR0-CAR9999. Leading spaces (e.g. CAR0005) are not used.
* Any member of the network can view any car details.
* Only members of IBM Org can update car records CAR0-CAR10.
* Only the current owner of a car record can modify it.
* A single user cannot own more than 20 cars.

These checks require us to identify which assets each individual owns. This is achieved through a hidden field called *certOwner*, which is part of every car stored in the world state. This is different to the exposed *owner* field of each car.


### Understanding *certOwner* and *owner*

It is possible for a user (using the changeCarOwner transaction) to change the *owner* field to a pretend value and retain the ability to modify it. However, it is possible to hand write privileges to another registered user by transferring the ownership of the car to them.

Specifically, the smart contract implements a policy which states that if the current owner changes the owner field to an ID that is registered on the network, then as soon as the new owner confirms the transfer using the *confirmTransfer* transaction, the previous owner will then lose the ability to modify it. In effect, passing write privileges to the new owner.

This two step transfer process ensures that if a user sets the owner field incorrectly, they have an opportunity to reclaim it. This policy mirrors many real-world transactions: for an asset transfer to be valid, both sender and receiver must agree.

These write privileges are determined by a hidden field in the car record called '<i>certOwner</i>'. The value of this field is the ID of the registered user who can currently write to it.

You can see the certOwner field when exploring transactions in the IBM Blockchain Platform web console (for example), but it's hidden from the output of the query transactions.


/*
 * SPDX-License-Identifier: Apache-2.0
 */
export class TimestampMapper {

  /////////////////////////////////////////////////////////////////////////////
  // Returns a JavaScript Date mapping to the protobuf timestamp object passed in
  // @return {!Date}
  // data has this shape:
  // let timestamp: any =
  //   {
  //     "seconds":
  //     {
  //       "low": 1590171534,
  //       "high": 0,
  //       "unsigned": false
  //     },
  //     "nanos": 380000000
  //   }
  /////////////////////////////////////////////////////////////////////////////
  public static toDate(data: any): Date {
    const seconds = data.seconds;
    const nanos = data.nanos;
    return new Date((seconds * 1000) + (nanos / 1000000));
  }
}

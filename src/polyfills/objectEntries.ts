/**
 * Object.entries() polyfill
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
 * https://vanillajstoolkit.com/polyfills/objectentries/
 */
if (!Object.entries) {
    Object.entries = function (obj) {
        const ownProps = Object.keys(obj);
        let i = ownProps.length;
        const resArray = new Array(i); // preallocate the Array

        while (i--) resArray[i] = [ownProps[i], obj[ownProps[i]]];

        return resArray;
    };
}

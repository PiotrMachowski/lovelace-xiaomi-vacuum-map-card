if (!String.prototype.replaceAll) {
    if (!RegExp) {
        String.prototype.replaceAll = function(str, newStr) {
            return this.split(str).join(newStr);
        };
    } else {
        String.prototype.replaceAll = function(str, newStr) {
            if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") {
                return this.replace(str, newStr);
            }
            return this.replace(new RegExp(str, "g"), newStr);
        };
    }
}

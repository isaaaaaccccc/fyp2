// static/js/dashboard/patchCanvas.js
(function() {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, opts) {
    if (type === '2d') {
      opts = Object.assign({ willReadFrequently: true }, opts || {});
    }
    return origGetContext.call(this, type, opts);
  };
})();

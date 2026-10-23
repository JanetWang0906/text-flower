/* Shared pointer-release policy; rendering and platform saving stay separate. */
(function (root, factory) {
  'use strict';
  const interaction = factory();
  if (typeof module === 'object' && module.exports) module.exports = interaction;
  else root.TextInteraction = interaction;
}(typeof window === 'object' ? window : this, function () {
  'use strict';
  function releaseAction(drag, allowStart, event, interrupted) {
    // A second finger must not release the pointer holding the rope.
    if (!drag || (event && event.pointerId !== drag.id)) return 'ignore';
    // OS gesture cancellation/capture loss does not mean the user pressed pause.
    if ((allowStart && (drag.armed || drag.previousStatus === 'playing')) ||
        (interrupted && drag.previousStatus === 'playing')) return 'continue';
    return 'restore';
  }
  return { releaseAction };
}));

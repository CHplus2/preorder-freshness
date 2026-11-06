const locks = new WeakMap();

// Dialogs can overlap while authentication or an exit transition replaces one.
// Restore the page's original scrolling only when the final owner releases it.
export function lockBodyScroll(body = document.body) {
  let lock = locks.get(body);
  if (!lock) {
    lock = {
      owners: new Set(),
      original: ['overflow-x', 'overflow-y'].map(property => [
        property, body.style.getPropertyValue(property), body.style.getPropertyPriority(property),
      ]),
    };
    locks.set(body, lock);
    body.style.setProperty('overflow', 'hidden');
  }
  const owner = Symbol();
  lock.owners.add(owner);
  return () => {
    if (!lock.owners.delete(owner) || lock.owners.size) return;
    body.style.removeProperty('overflow');
    for (const [property, value, priority] of lock.original) {
      if (value) body.style.setProperty(property, value, priority);
    }
    locks.delete(body);
  };
}

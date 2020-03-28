import { isFunction } from './fns'

export function matchesSelectorToParentElements (el, selector, baseNode) {
  let node = el

  const matchesSelectorFunc = [
    'matches',
    'webkitMatchesSelector',
    'mozMatchesSelector',
    'msMatchesSelector',
    'oMatchesSelector'
  ].find(func => isFunction(node[func]))

  if (!isFunction(node[matchesSelectorFunc])) return false

  do {
    if (node[matchesSelectorFunc](selector)) return true
    if (node === baseNode) return false
    node = node.parentNode
  } while (node)

  return false
}

export function getComputedSize ($el) {
  const style = window.getComputedStyle($el)

  return [
    parseFloat(style.getPropertyValue('width'), 10),
    parseFloat(style.getPropertyValue('height'), 10)
  ]
}

export function addEvent (el, event, handler) {
  if (!el) {
    return
  }
  if (el.attachEvent) {
    el.attachEvent('on' + event, handler)
  } else if (el.addEventListener) {
    el.addEventListener(event, handler, true)
  } else {
    el['on' + event] = handler
  }
}

export function removeEvent (el, event, handler) {
  if (!el) {
    return
  }
  if (el.detachEvent) {
    el.detachEvent('on' + event, handler)
  } else if (el.removeEventListener) {
    el.removeEventListener(event, handler, true)
  } else {
    el['on' + event] = null
  }
}

/*
export function outerHeight(node) {
  // This is deliberately excluding margin for our calculations, since we are using
  // offsetTop which is including margin. See getBoundPosition
  let height = node.clientHeight
  const computedStyle = node.ownerDocument.defaultView.getComputedStyle(node)
  height += int(computedStyle.borderTopWidth)
  height += int(computedStyle.borderBottomWidth)
  return height
}

export function outerWidth(node) {
  // This is deliberately excluding margin for our calculations, since we are using
  // offsetLeft which is including margin. See getBoundPosition
  let width = node.clientWidth
  const computedStyle = node.ownerDocument.defaultView.getComputedStyle(node)
  width += int(computedStyle.borderLeftWidth)
  width += int(computedStyle.borderRightWidth)
  return width
}
export function innerHeight(node) {
  let height = node.clientHeight
  const computedStyle = node.ownerDocument.defaultView.getComputedStyle(node)
  height -= int(computedStyle.paddingTop)
  height -= int(computedStyle.paddingBottom)
  return height
}

export function innerWidth(node) {
  let width = node.clientWidth
  const computedStyle = node.ownerDocument.defaultView.getComputedStyle(node)
  width -= int(computedStyle.paddingLeft)
  width -= int(computedStyle.paddingRight)
  return width
}

// Get from offsetParent
export function offsetXYFromParent(evt, offsetParent) {
  const isBody = offsetParent === offsetParent.ownerDocument.body
  const offsetParentRect = isBody ? {left: 0, top: 0} : offsetParent.getBoundingClientRect()

  const x = evt.clientX + offsetParent.scrollLeft - offsetParentRect.left
  const y = evt.clientY + offsetParent.scrollTop - offsetParentRect.top

  return {x, y}
}

// bounds === parent
export function getBoundPosition($el, bounds) {
  // Clone new bounds
  bounds = typeof bounds === 'string' ? bounds : cloneBounds(bounds);
  const node = findDOMNode(draggable);

  if (typeof bounds === 'string') {
    const {ownerDocument} = node;
    const ownerWindow = ownerDocument.defaultView;
    let boundNode;
    if (bounds === 'parent') {
      boundNode = node.parentNode;
    } else {
      boundNode = ownerDocument.querySelector(bounds);
    }
    if (!(boundNode instanceof ownerWindow.HTMLElement)) {
      throw new Error('Bounds selector "' + bounds + '" could not find an element.');
    }
    const nodeStyle = ownerWindow.getComputedStyle(node);
    const boundNodeStyle = ownerWindow.getComputedStyle(boundNode);
    // Compute bounds. This is a pain with padding and offsets but this gets it exactly right.
    bounds = {
      left: -node.offsetLeft + int(boundNodeStyle.paddingLeft) + int(nodeStyle.marginLeft),
      top: -node.offsetTop + int(boundNodeStyle.paddingTop) + int(nodeStyle.marginTop),
      right: innerWidth(boundNode) - outerWidth(node) - node.offsetLeft +
        int(boundNodeStyle.paddingRight) - int(nodeStyle.marginRight),
      bottom: innerHeight(boundNode) - outerHeight(node) - node.offsetTop +
        int(boundNodeStyle.paddingBottom) - int(nodeStyle.marginBottom)
    };
  }

  // Keep x and y below right and bottom limits...
  if (isNum(bounds.right)) x = Math.min(x, bounds.right)
  if (isNum(bounds.bottom)) y = Math.min(y, bounds.bottom)

  // But above left and top limits.
  if (isNum(bounds.left)) x = Math.max(x, bounds.left)
  if (isNum(bounds.top)) y = Math.max(y, bounds.top)

  return [x, y]
}
*/

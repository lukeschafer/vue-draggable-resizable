<template>
  <div
    :style="style"
    :class="[{
      [classNameActive]: enabled,
      [classNameDragging]: dragging,
      [classNameResizing]: resizing,
      [classNameDraggable]: draggable,
      [classNameResizable]: resizable
    }, className]"
    @mousedown="elementDown"
    @touchstart="elementTouchDown"
  >
    <div
      v-for="handle in actualHandles"
      :key="handle"
      :class="[classNameHandle, classNameHandle + '-' + handle]"
      :style="{display: enabled ? 'block' : 'none'}"
      @mousedown.stop.prevent="handleDown(handle, $event)"
      @touchstart.stop.prevent="handleTouchDown(handle, $event)"
    >
      <slot :name="handle"></slot>
    </div>
    <slot>
      <div class="wrapper">
        <div>({{ this.x }},{{ this.y }})</div>
        <div>{{ this.top }}</div>
        <div></div>
        <div>{{ this.left }}</div>
        <div>{{ this.width }}x{{ this.height }}</div>
        <div>{{ this.right }}</div>
        <div></div>
        <div>{{ this.bottom }}</div>
        <div>{{ this.aspectFactor }}</div>
      </div>
    </slot>
  </div>
</template>

<script>
import { matchesSelectorToParentElements, addEvent, removeEvent } from '../utils/dom'
import { computeWidth, computeHeight, getSize, restrictToBounds, snapToGrid } from '../utils/fns'

const events = {
  mouse: {
    start: 'mousedown',
    move: 'mousemove',
    stop: 'mouseup'
  },
  touch: {
    start: 'touchstart',
    move: 'touchmove',
    stop: 'touchend'
  }
}

const userSelectNone = {
  userSelect: 'none',
  MozUserSelect: 'none',
  WebkitUserSelect: 'none',
  MsUserSelect: 'none'
}

const userSelectAuto = {
  userSelect: 'auto',
  MozUserSelect: 'auto',
  WebkitUserSelect: 'auto',
  MsUserSelect: 'auto'
}

let eventsFor = events.mouse

export default {
  replace: true,
  name: 'vue-draggable-resizable',
  props: {
    className: {
      type: String,
      default: 'vdr'
    },
    classNameDraggable: {
      type: String,
      default: 'draggable'
    },
    classNameResizable: {
      type: String,
      default: 'resizable'
    },
    classNameDragging: {
      type: String,
      default: 'dragging'
    },
    classNameResizing: {
      type: String,
      default: 'resizing'
    },
    classNameActive: {
      type: String,
      default: 'active'
    },
    classNameHandle: {
      type: String,
      default: 'handle'
    },
    disableUserSelect: {
      type: Boolean,
      default: true
    },
    enableNativeDrag: {
      type: Boolean,
      default: false
    },
    preventDeactivation: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: false
    },
    draggable: {
      type: Boolean,
      default: true
    },
    resizable: {
      type: Boolean,
      default: true
    },
    lockAspectRatio: {
      type: Boolean,
      default: false
    },
    w: {
      type: Number,
      default: 200,
      validator: (val) => val > 0
    },
    h: {
      type: Number,
      default: 200,
      validator: (val) => val > 0
    },
    minWidth: {
      type: Number,
      default: 0,
      validator: (val) => val >= 0
    },
    minHeight: {
      type: Number,
      default: 0,
      validator: (val) => val >= 0
    },
    maxWidth: {
      type: Number,
      default: null,
      validator: (val) => val >= 0
    },
    maxHeight: {
      type: Number,
      default: null,
      validator: (val) => val >= 0
    },
    x: {
      type: Number,
      default: 0,
      validator: (val) => typeof val === 'number'
    },
    y: {
      type: Number,
      default: 0,
      validator: (val) => typeof val === 'number'
    },
    z: {
      type: [String, Number],
      default: 'auto',
      validator: (val) => (typeof val === 'string' ? val === 'auto' : val >= 0)
    },
    handles: {
      type: Array,
      default: () => ['tl', 'tm', 'tr', 'mr', 'br', 'bm', 'bl', 'ml'],
      validator: (val) => {
        const s = new Set(['tl', 'tm', 'tr', 'mr', 'br', 'bm', 'bl', 'ml'])

        return new Set(val.filter(h => s.has(h))).size === val.length
      }
    },
    dragHandle: {
      type: String,
      default: null
    },
    dragCancel: {
      type: String,
      default: null
    },
    axis: {
      type: String,
      default: 'both',
      validator: (val) => ['x', 'y', 'both'].includes(val)
    },
    grid: {
      type: Array,
      default: () => [1, 1]
    },
    parent: {
      type: Boolean,
      default: false
    },
    scale: {
      type: Number,
      default: 1,
      validator: (val) => val > 0
    },
    onDragStart: {
      type: Function,
      default: null
    },
    onDrag: {
      type: Function,
      default: () => true
    },
    onResizeStart: {
      type: Function,
      default: null
    },
    onResize: {
      type: Function,
      default: () => true
    }
  },

  data: function () {
    return {
      left: this.x,
      top: this.y,
      right: null,
      bottom: null,

      width: this.w,
      height: this.h,

      aspectFactor: this.w / this.h,

      parentWidth: null,
      parentHeight: null,

      minW: this.minWidth,
      minH: this.minHeight,

      maxW: this.maxWidth,
      maxH: this.maxHeight,

      handle: null,
      enabled: this.active,
      resizing: false,
      dragging: false,
      zIndex: this.z
    }
  },

  created: function () {
    // eslint-disable-next-line
    if (this.maxWidth && this.minWidth > this.maxWidth) console.warn('[Vdr warn]: Invalid prop: minWidth cannot be greater than maxWidth')
    // eslint-disable-next-line
    if (this.maxWidth && this.minHeight > this.maxHeight) console.warn('[Vdr warn]: Invalid prop: minHeight cannot be greater than maxHeight')

    this.resetBoundsAndMouseState()
  },
  mounted: function () {
    if (!this.enableNativeDrag) {
      this.$el.ondragstart = () => false
    }

    // l'idea qui è di fare tutti i calcoli per
    // determinare la larghezza e l'altezza in base a parent
    // - se w e h === auto
    //  non appena comincio a ridimensionare, uso nuovi valori

    const [width, height] = [this.width, this.height]
    // getSize(this.$el)

    const [parentWidth, parentHeight] = this.getParentSize()

    this.parentWidth = parentWidth
    this.parentHeight = parentHeight

    this.right = this.parentWidth - width - this.left
    this.bottom = this.parentHeight - height - this.top

    addEvent(document.documentElement, 'mousedown', this.deselect)
    addEvent(document.documentElement, 'touchend touchcancel', this.deselect)

    addEvent(window, 'resize', this.checkParentSize)
  },
  beforeDestroy: function () {
    removeEvent(document.documentElement, 'mousedown', this.deselect)
    removeEvent(document.documentElement, 'touchstart', this.handleUp)
    removeEvent(document.documentElement, 'mousemove', this.move)
    removeEvent(document.documentElement, 'touchmove', this.move)
    removeEvent(document.documentElement, 'mouseup', this.handleUp)
    removeEvent(document.documentElement, 'touchend touchcancel', this.deselect)

    removeEvent(window, 'resize', this.checkParentSize)
  },

  methods: {
    resetBoundsAndMouseState () {
      this.mouseClickPosition = { mouseX: 0, mouseY: 0, x: 0, y: 0, w: 0, h: 0 }

      this.bounds = {
        minLeft: null,
        maxLeft: null,
        minRight: null,
        maxRight: null,
        minTop: null,
        maxTop: null,
        minBottom: null,
        maxBottom: null
      }
    },
    checkParentSize () {
      if (this.parent) {
        const [newParentWidth, newParentHeight] = this.getParentSize()

        const deltaX = this.parentWidth - newParentWidth
        const deltaY = this.parentHeight - newParentHeight

        this.rawRight -= deltaX
        this.rawBottom -= deltaY

        this.parentWidth = newParentWidth
        this.parentHeight = newParentHeight
      }
    },
    getParentSize () {
      if (this.parent) {
        const style = window.getComputedStyle(this.$el.parentNode, null)

        return [
          parseInt(style.getPropertyValue('width'), 10),
          parseInt(style.getPropertyValue('height'), 10)
        ]
      }

      return [null, null]
    },
    elementTouchDown (e) {
      eventsFor = events.touch

      this.elementDown(e)
    },
    elementDown (e) {
      const target = e.target || e.srcElement

      if (this.$el.contains(target)) {
        if (this.onDragStart && this.onDragStart(e) === false) {
          return
        }

        if (
          (this.dragHandle && !matchesSelectorToParentElements(target, this.dragHandle, this.$el)) ||
          (this.dragCancel && matchesSelectorToParentElements(target, this.dragCancel, this.$el))
        ) {
          return
        }

        if (!this.enabled) {
          this.enabled = true

          this.$emit('activated')
          this.$emit('update:active', true)
        }

        if (this.draggable) {
          this.dragging = true
        }

        this.mouseClickPosition.mouseX = e.touches ? e.touches[0].pageX : e.pageX
        this.mouseClickPosition.mouseY = e.touches ? e.touches[0].pageY : e.pageY

        this.mouseClickPosition.left = this.left
        this.mouseClickPosition.right = this.right
        this.mouseClickPosition.top = this.top
        this.mouseClickPosition.bottom = this.bottom

        if (this.parent) {
          this.bounds = this.calcDragLimits()
        }

        addEvent(document.documentElement, eventsFor.move, this.move)
        addEvent(document.documentElement, eventsFor.stop, this.handleUp)
      }
    },
    calcDragLimits () {
      return {
        minLeft: (this.parentWidth + this.left) % this.grid[0],
        maxLeft: Math.floor((this.parentWidth - this.width - this.left) / this.grid[0]) * this.grid[0] + this.left,
        minRight: (this.parentWidth + this.right) % this.grid[0],
        maxRight: Math.floor((this.parentWidth - this.width - this.right) / this.grid[0]) * this.grid[0] + this.right,
        minTop: (this.parentHeight + this.top) % this.grid[1],
        maxTop: Math.floor((this.parentHeight - this.height - this.top) / this.grid[1]) * this.grid[1] + this.top,
        minBottom: (this.parentHeight + this.bottom) % this.grid[1],
        maxBottom: Math.floor((this.parentHeight - this.height - this.bottom) / this.grid[1]) * this.grid[1] + this.bottom
      }
    },
    deselect (e) {
      const target = e.target || e.srcElement
      const regex = new RegExp(this.className + '-([trmbl]{2})', '')

      if (!this.$el.contains(target) && !regex.test(target.className)) {
        if (this.enabled && !this.preventDeactivation) {
          this.enabled = false

          this.$emit('deactivated')
          this.$emit('update:active', false)
        }

        removeEvent(document.documentElement, eventsFor.move, this.handleMove)
      }

      this.resetBoundsAndMouseState()
    },
    handleTouchDown (handle, e) {
      eventsFor = events.touch

      this.handleDown(handle, e)
    },
    handleDown (handle, e) {
      if (this.onResizeStart && this.onResizeStart(handle, e) === false) {
        return
      }

      if (e.stopPropagation) e.stopPropagation()

      // Here we avoid a dangerous recursion by faking
      // corner handles as middle handles
      if (this.lockAspectRatio && !handle.includes('m')) {
        this.handle = 'm' + handle.substring(1)
      } else {
        this.handle = handle
      }

      this.resizing = true

      this.mouseClickPosition.mouseX = e.touches ? e.touches[0].pageX : e.pageX
      this.mouseClickPosition.mouseY = e.touches ? e.touches[0].pageY : e.pageY
      this.mouseClickPosition.left = this.left
      this.mouseClickPosition.right = this.right
      this.mouseClickPosition.top = this.top
      this.mouseClickPosition.bottom = this.bottom

      this.bounds = this.calcResizeLimits()

      addEvent(document.documentElement, eventsFor.move, this.handleMove)
      addEvent(document.documentElement, eventsFor.stop, this.handleUp)
    },
    calcResizeLimits () {
      let minW = this.minW
      let minH = this.minH
      let maxW = this.maxW
      let maxH = this.maxH

      const aspectFactor = this.aspectFactor
      const [gridX, gridY] = this.grid
      const width = this.width
      const height = this.height
      const left = this.left
      const top = this.top
      const right = this.right
      const bottom = this.bottom

      if (this.lockAspectRatio) {
        if (minW / minH > aspectFactor) {
          minH = minW / aspectFactor
        } else {
          minW = aspectFactor * minH
        }

        if (maxW && maxH) {
          maxW = Math.min(maxW, aspectFactor * maxH)
          maxH = Math.min(maxH, maxW / aspectFactor)
        } else if (maxW) {
          maxH = maxW / aspectFactor
        } else if (maxH) {
          maxW = aspectFactor * maxH
        }
      }

      maxW = maxW - (maxW % gridX)
      maxH = maxH - (maxH % gridY)

      const limits = {
        minLeft: null,
        maxLeft: null,
        minTop: null,
        maxTop: null,
        minRight: null,
        maxRight: null,
        minBottom: null,
        maxBottom: null
      }

      if (this.parent) {
        limits.minLeft = (this.parentWidth + left) % gridX
        limits.maxLeft = left + Math.floor((width - minW) / gridX) * gridX
        limits.minTop = (this.parentHeight + top) % gridY
        limits.maxTop = top + Math.floor((height - minH) / gridY) * gridY
        limits.minRight = (this.parentWidth + right) % gridX
        limits.maxRight = right + Math.floor((width - minW) / gridX) * gridX
        limits.minBottom = (this.parentHeight + bottom) % gridY
        limits.maxBottom = bottom + Math.floor((height - minH) / gridY) * gridY

        if (maxW) {
          limits.minLeft = Math.max(limits.minLeft, this.parentWidth - right - maxW)
          limits.minRight = Math.max(limits.minRight, this.parentWidth - left - maxW)
        }

        if (maxH) {
          limits.minTop = Math.max(limits.minTop, this.parentHeight - bottom - maxH)
          limits.minBottom = Math.max(limits.minBottom, this.parentHeight - top - maxH)
        }

        if (this.lockAspectRatio) {
          limits.minLeft = Math.max(limits.minLeft, left - top * aspectFactor)
          limits.minTop = Math.max(limits.minTop, top - left / aspectFactor)
          limits.minRight = Math.max(limits.minRight, right - bottom * aspectFactor)
          limits.minBottom = Math.max(limits.minBottom, bottom - right / aspectFactor)
        }
      } else {
        limits.minLeft = null
        limits.maxLeft = left + Math.floor((width - minW) / gridX) * gridX
        limits.minTop = null
        limits.maxTop = top + Math.floor((height - minH) / gridY) * gridY
        limits.minRight = null
        limits.maxRight = right + Math.floor((width - minW) / gridX) * gridX
        limits.minBottom = null
        limits.maxBottom = bottom + Math.floor((height - minH) / gridY) * gridY

        if (maxW) {
          limits.minLeft = -(right + maxW)
          limits.minRight = -(left + maxW)
        }

        if (maxH) {
          limits.minTop = -(bottom + maxH)
          limits.minBottom = -(top + maxH)
        }

        if (this.lockAspectRatio && (maxW && maxH)) {
          limits.minLeft = Math.min(limits.minLeft, -(right + maxW))
          limits.minTop = Math.min(limits.minTop, -(maxH + bottom))
          limits.minRight = Math.min(limits.minRight, -left - maxW)
          limits.minBottom = Math.min(limits.minBottom, -top - maxH)
        }
      }

      return limits
    },
    move (e) {
      if (this.resizing) {
        this.handleMove(e)
      } else if (this.dragging) {
        this.handleElementMoveEvent(e)
      }
    },
    handleElementMoveEvent (e) {
      const axis = this.axis
      const grid = this.grid
      const bounds = this.bounds
      const mouseClickPosition = this.mouseClickPosition

      const tmpDeltaX = axis && axis !== 'y' ? mouseClickPosition.mouseX - (e.touches ? e.touches[0].pageX : e.pageX) : 0
      const tmpDeltaY = axis && axis !== 'x' ? mouseClickPosition.mouseY - (e.touches ? e.touches[0].pageY : e.pageY) : 0

      const [deltaX, deltaY] = snapToGrid(grid, tmpDeltaX, tmpDeltaY, this.scale)

      const left = restrictToBounds(mouseClickPosition.left - deltaX, bounds.minLeft, bounds.maxLeft)
      const top = restrictToBounds(mouseClickPosition.top - deltaY, bounds.minTop, bounds.maxTop)
      const right = restrictToBounds(mouseClickPosition.right + deltaX, bounds.minRight, bounds.maxRight)
      const bottom = restrictToBounds(mouseClickPosition.bottom + deltaY, bounds.minBottom, bounds.maxBottom)

      if (this.onDrag (left, top)) {
        this.left = left
        this.top = top
        this.right = right
        this.bottom = bottom

        this.$emit('dragging', this.left, this.top)
      }
    },
    _elementMove(tmpDeltaX, tmpDeltaY) {
      // logica strettamente legata a watch
      const grid = this.grid
      const bounds = this.bounds

      const [deltaX, deltaY] = snapToGrid(grid, tmpDeltaX, tmpDeltaY, this.scale)

      const left = restrictToBounds(deltaX, bounds.minLeft, bounds.maxLeft)
      const top = restrictToBounds(deltaY, bounds.minTop, bounds.maxTop)

      this.left = left
      this.top = top
      this.right = this.parentWidth - this.width - left
      this.bottom = this.parentHeight - this.height - top
    },
    handleMove (e) {
      let left = this.left
      let top = this.top
      let right = this.right
      let bottom = this.bottom

      const mouseClickPosition = this.mouseClickPosition
      const lockAspectRatio = this.lockAspectRatio
      const aspectFactor = this.aspectFactor

      const tmpDeltaX = mouseClickPosition.mouseX - (e.touches ? e.touches[0].pageX : e.pageX)
      const tmpDeltaY = mouseClickPosition.mouseY - (e.touches ? e.touches[0].pageY : e.pageY)

      const [deltaX, deltaY] = snapToGrid(this.grid, tmpDeltaX, tmpDeltaY, this.scale)

      if (this.handle.includes('b')) {
        bottom = restrictToBounds(
          mouseClickPosition.bottom + deltaY,
          this.bounds.minBottom,
          this.bounds.maxBottom
        )

        if (this.lockAspectRatio && this.resizingOnY) {
          right = this.right - (this.bottom - bottom) * aspectFactor
        }
      } else if (this.handle.includes('t')) {
        top = restrictToBounds(
          mouseClickPosition.top - deltaY,
          this.bounds.minTop,
          this.bounds.maxTop
        )

        if (this.lockAspectRatio && this.resizingOnY) {
          left = this.left - (this.top - top) * aspectFactor
        }
      }

      if (this.handle.includes('r')) {
        right = restrictToBounds(
          mouseClickPosition.right + deltaX,
          this.bounds.minRight,
          this.bounds.maxRight
        )

        if (this.lockAspectRatio && this.resizingOnX) {
          bottom = this.bottom - (this.right - right) / aspectFactor
        }
      } else if (this.handle.includes('l')) {
        left = restrictToBounds(
          mouseClickPosition.left - deltaX,
          this.bounds.minLeft,
          this.bounds.maxLeft
        )

        if (this.lockAspectRatio && this.resizingOnX) {
          top = this.top - (this.left - left) / aspectFactor
        }
      }

      const width = computeWidth(this.parentWidth, left, right)
      const height = computeHeight(this.parentHeight, top, bottom)

      if (this.onResize (left, top, width, height)) {
        this.left = left
        this.top = top
        this.right = right
        this.bottom = bottom
        this.width = width
        this.height = height

        this.$emit('resizing', this.left, this.top, this.width, this.height)
      }
    },
    _changeWidth(val) {
      const [newWidth, _] = snapToGrid(this.grid, val, 0, this.scale)

      let right = restrictToBounds(
        (this.parentWidth - newWidth - this.left),
        this.bounds.minRight,
        this.bounds.maxRight
      )
      let bottom = this.bottom

      if (this.lockAspectRatio) {
        bottom = this.bottom - (this.right - right) / this.aspectFactor
      }

      const width = computeWidth(this.parentWidth, this.left, right)
      const height = computeHeight(this.parentHeight, this.top, bottom)

      this.right = right
      this.bottom = bottom
      this.width = width
      this.height = height
    },
    _changeHeight(val) {
      const [_, newHeight] = snapToGrid(this.grid, 0, val, this.scale)

      let bottom = restrictToBounds(
        (this.parentHeight - newHeight - this.top),
        this.bounds.minBottom,
        this.bounds.maxBottom
      )
      let right = this.right

      if (this.lockAspectRatio) {
        right = this.right - (this.bottom - bottom) * this.aspectFactor
      }

      const width = computeWidth(this.parentWidth, this.left, right)
      const height = computeHeight(this.parentHeight, this.top, bottom)

      this.right = right
      this.bottom = bottom
      this.width = width
      this.height = height
    },
    handleUp (e) {
      this.handle = null

      this.resetBoundsAndMouseState()

      if (this.resizing) {
        this.resizing = false
        this.$emit('resizestop', this.left, this.top, this.width, this.height)
      }
      if (this.dragging) {
        this.dragging = false
        this.$emit('dragstop', this.left, this.top)
      }

      removeEvent(document.documentElement, eventsFor.move, this.handleMove)
    }
  },
  computed: {
    style () {
      return {
        transform: `translate(${this.left}px, ${this.top}px)`,
        width: this.width + 'px',
        height: this.height + 'px',
        zIndex: this.zIndex,
        ...(this.dragging && this.disableUserSelect ? userSelectNone : userSelectAuto)
      }
    },
    actualHandles () {
      if (!this.resizable) return []

      return this.handles
    },
    // width () {
    //   return this.parentWidth - this.left - this.right
    // },
    // height () {
    //   return this.parentHeight - this.top - this.bottom
    // },
    resizingOnX () {
      return (Boolean(this.handle) && (this.handle.includes('l') || this.handle.includes('r')))
    },
    resizingOnY () {
      return (Boolean(this.handle) && (this.handle.includes('t') || this.handle.includes('b')))
    },
    isCornerHandle () {
      return (Boolean(this.handle) && ['tl', 'tr', 'br', 'bl'].includes(this.handle))
    }
  },

  watch: {
    active (val) {
      this.enabled = val

      if (val) {
        this.$emit('activated')
      } else {
        this.$emit('deactivated')
      }
    },
    z (val) {
      if (val >= 0 || val === 'auto') {
        this.zIndex = val
      }
    },
    rawLeft (newLeft) {
      // const bounds = this.bounds
      // const aspectFactor = this.aspectFactor
      // const lockAspectRatio = this.lockAspectRatio
      // const left = this.left
      // const top = this.top

      // newLeft = restrictToBounds(newLeft, bounds.minLeft, bounds.maxLeft)

      // if (bounds.minLeft !== null && newLeft < bounds.minLeft) {
      //   newLeft = bounds.minLeft
      // } else if (bounds.maxLeft !== null && bounds.maxLeft < newLeft) {
      //   newLeft = bounds.maxLeft
      // }

      // if (lockAspectRatio && this.resizingOnX) {
      //   this.rawTop = top - (left - newLeft) / aspectFactor
      // }

      // this.left = newLeft
    },
    rawRight (newRight) {
      // const bounds = this.bounds
      // const aspectFactor = this.aspectFactor
      // const lockAspectRatio = this.lockAspectRatio
      // const right = this.right
      // const bottom = this.bottom

      // newRight = restrictToBounds(newRight, bounds.minRight, bounds.maxRight)

      // if (bounds.minRight !== null && newRight < bounds.minRight) {
      //   newRight = bounds.minRight
      // } else if (bounds.maxRight !== null && bounds.maxRight < newRight) {
      //   newRight = bounds.maxRight
      // }

      // if (lockAspectRatio && this.resizingOnX) {
      //   this.rawBottom = bottom - (right - newRight) / aspectFactor
      // }

      // this.right = newRight
    },
    rawTop (newTop) {
      // const bounds = this.bounds
      // const aspectFactor = this.aspectFactor
      // const lockAspectRatio = this.lockAspectRatio
      // const left = this.left
      // const top = this.top

      // newTop = restrictToBounds(newTop, bounds.minTop, bounds.maxTop)

      // if (bounds.minTop !== null && newTop < bounds.minTop) {
      //   newTop = bounds.minTop
      // } else if (bounds.maxTop !== null && bounds.maxTop < newTop) {
      //   newTop = bounds.maxTop
      // }

      // if (lockAspectRatio && this.resizingOnY) {
      //   this.rawLeft = left - (top - newTop) * aspectFactor
      // }

      // this.top = newTop
    },
    rawBottom (newBottom) {
      // const bounds = this.bounds
      // const aspectFactor = this.aspectFactor
      // const lockAspectRatio = this.lockAspectRatio
      // const right = this.right
      // const bottom = this.bottom

      // newBottom = restrictToBounds(newBottom, bounds.minBottom, bounds.maxBottom)

      // if (bounds.minBottom !== null && newBottom < bounds.minBottom) {
      //   newBottom = bounds.minBottom
      // } else if (bounds.maxBottom !== null && bounds.maxBottom < newBottom) {
      //   newBottom = bounds.maxBottom
      // }

      // if (lockAspectRatio && this.resizingOnY) {
      //   this.rawRight = right - (bottom - newBottom) * aspectFactor
      // }

      // this.bottom = newBottom
    },
    x (val) {
      if (this.resizing || this.dragging) {
        return
      }

      if (this.parent) {
        this.bounds = this.calcDragLimits()
      }

      this._elementMove(val, this.top)

      // if (delta % this.grid[0] === 0) {
      //   this.rawLeft = this.x
      //   this.rawRight = this.right - delta
      // }
    },
    y (val) {
      if (this.resizing || this.dragging) {
        return
      }

      if (this.parent) {
        this.bounds = this.calcDragLimits()
      }

      this._elementMove(this.left, val)

      // const delta = this.y - this.top

      // if (delta % this.grid[1] === 0) {
      //   this.rawTop = this.y
      //   this.rawBottom = this.bottom - delta
      // }
    },
    lockAspectRatio (val) {
      if (val) {
        this.aspectFactor = this.width / this.height
      } else {
        this.aspectFactor = undefined
      }
    },
    minWidth (val) {
      if (val > 0 && val <= this.width) {
        this.minW = val
      }
    },
    minHeight (val) {
      if (val > 0 && val <= this.height) {
        this.minH = val
      }
    },
    maxWidth (val) {
      this.maxW = val
    },
    maxHeight (val) {
      this.maxH = val
    },
    w (val) {
      if (this.resizing || this.dragging) {
        return
      }

      if (this.parent) {
        this.bounds = this.calcResizeLimits()
      }

      this._changeWidth(val)

      // this.right = this.parentWidth - val - this.left
      // this.width = val

      // const delta = this.width - this.w

      // if (delta % this.grid[0] === 0) {
      //   this.rawRight = this.right + delta
      // }
    },
    h (val) {
      if (this.resizing || this.dragging) {
        return
      }

      if (this.parent) {
        this.bounds = this.calcResizeLimits()
      }

      this._changeHeight(val)

      // const delta = this.height - this.h

      // if (delta % this.grid[1] === 0) {
      //   this.rawBottom = this.bottom + delta
      // }
    }
  }
}
</script>

<style>
  .wrapper {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-gap: 10px;
    grid-auto-rows: auto;
  }

  .wrapper div {
    border: 1px solid lightgray;
  }
</style>

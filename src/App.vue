<template>
  <div id="app">
    <div style="height: 500px; width: 500px; border: 1px solid red; position: relative;">
      <vue-draggable-resizable :x="x" :y="y" :w="width" :h="height" :lockAspectRatio="true" :parent="false" @resizing="onResize" @dragging="onDrag">
      </vue-draggable-resizable>
    </div>
    <div id="toolbar">
        X: <input type="number" v-model.number="x">
        Y: <input type="number" v-model.number="y">
        Width: <input type="number" v-model.number="width">
        Height: <input type="number" v-model.number="height">
    </div>
  </div>
</template>

<script>
import VueDraggableResizable from './components/vue-draggable-resizable'
import './components/vue-draggable-resizable.css'

export default {
  name: 'app',
  components: {
    VueDraggableResizable
  },
  data: function () {
    return {
      x: 20,
      y: 20,
      width: 100,
      height: 100
    }
  },
  methods: {
    onDrag(left, top) {
      this.x = left
      this.y = top
    },
    onResize(left, top, width, height) {
      this.x = left
      this.y = top
      this.width = width
      this.height = height
    }
  }
}
</script>

<style>
  .vdr {
    border: 1px dashed black;
  }
</style>

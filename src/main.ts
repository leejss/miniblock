type Block =  {
  id: string
  content: string
  type: string
}

export class BlockEditor {
  private state: Block[]
  private root: HTMLElement
  constructor(rootId: string) {
    this.root = document.getElementById(rootId) as HTMLElement
    this.state = [
      {
        id: this.generateId(),
        content: 'Hello World',
        type: "h1"
      }
    ]

    this.init()
  }

  init() {
    this.render()
  }

  private generateId(): string {
    return crypto.randomUUID()
  }

  private render() {
    this.root.innerHTML = ''
    // iterate over the state and render the blocks
    this.state.forEach((block) => {
      // render block. add event
      // element, attr, innerText
      const el = document.createElement(block.type) as HTMLElement
      el.contentEditable = 'true'
      el.className = `block block-${block.type}`
      el.dataset.id = block.id
      el.innerText = block.content

      el.addEventListener("input", (e) => this.handleInput(e, block.id))
      this.root.appendChild(el)
    })

    this.updateDebugger()
  }

  // intercept input event and update state
  private handleInput(e: Event, blockId: string) {
   const text = (e.target as HTMLElement).innerText
    // find block by blockId and update content
    const block = this.state.find(b => b.id === blockId)
    if (block) {
      block.content = text
    }
    this.updateDebugger()
  }

  private updateDebugger() {
    const debugEl = document.getElementById('state-debugger')
    if (debugEl) {
      debugEl.innerHTML = `<pre class="debug-json"><code>${JSON.stringify(this.state, null, 2)}</code></pre>`
    }
  }
}

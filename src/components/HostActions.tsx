import type { MarkdownSelectionAction, MarkdownSelectionActionContext } from '../editor/integration'

export function HostActions({ actions, context, capture }: {
  actions: MarkdownSelectionAction[]
  context: MarkdownSelectionActionContext
  capture(): MarkdownSelectionActionContext
}) {
  return <div className="exmd-host-actions">
    {actions.map(action => <button key={action.id} type="button" title={action.title} aria-label={action.title}
      disabled={action.disabled || (action.requiresSelection !== false && !context.anchor)}
      onPointerDown={event => event.preventDefault()} onMouseDown={event => event.preventDefault()}
      onClick={() => {
        const latest = capture()
        if (!action.disabled && (action.requiresSelection === false || latest.anchor)) action.onClick(latest)
      }}>{action.icon || action.title}</button>)}
  </div>
}

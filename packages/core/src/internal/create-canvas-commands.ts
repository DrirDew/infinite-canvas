import type { CanvasCommands } from "../canvas/commands.js";
import type { CanvasCommandContext } from "./canvas-command-context.js";
import { createCanvasCommandRuntime } from "./canvas-command-runtime.js";
import { createClipboardCommands } from "./commands/clipboard-commands.js";
import { createConnectionCommands } from "./commands/connection-commands.js";
import { createDocumentCommands } from "./commands/document-commands.js";
import { createHistoryCommands } from "./commands/history-commands.js";
import { createNodeInteractionCommands } from "./commands/node-interaction-commands.js";
import { createSelectionCommands } from "./commands/selection-commands.js";

export function createCanvasCommands<TMetadata>(context: CanvasCommandContext<TMetadata>): CanvasCommands<TMetadata> {
    const runtime = createCanvasCommandRuntime(context);
    return { ...createDocumentCommands(context, runtime), ...createSelectionCommands(context, runtime), ...createNodeInteractionCommands(context, runtime), ...createConnectionCommands(context, runtime), ...createClipboardCommands(context, runtime), ...createHistoryCommands(context, runtime) };
}

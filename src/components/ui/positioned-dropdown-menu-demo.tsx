/**
 * Demo component showing the new PositionedDropdownMenuContent in action
 *
 * This demonstrates:
 * - Right-click context menu with intelligent positioning
 * - Automatic edge detection and avoidance
 * - No crashes with null values
 * - Works at all screen edges
 */

import { useState } from "react";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "./dropdown-menu";
import { PositionedDropdownMenuContent } from "./positioned-dropdown-menu";
import { IconEdit, IconTrash, IconCopy, IconEye } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";

interface ContextMenuPosition {
  x: number;
  y: number;
}

export function PositionedDropdownMenuDemo() {
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const [lastAction, setLastAction] = useState<string>("");

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAction = (action: string) => {
    setLastAction(action);
    setContextMenu(null);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Intelligent Menu Positioning Demo</CardTitle>
            <CardDescription>
              Right-click anywhere in the colored areas below to test the new positioning system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastAction && (
              <Badge variant="outline" className="mb-4">
                Last action: {lastAction}
              </Badge>
            )}

            <div className="grid grid-cols-3 gap-4">
              {/* Top Left */}
              <div
                onContextMenu={handleContextMenu}
                className="h-32 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              >
                <p className="text-sm font-medium text-center">
                  Top Left Corner
                  <br />
                  <span className="text-xs text-muted-foreground">Right-click me</span>
                </p>
              </div>

              {/* Top Center */}
              <div
                onContextMenu={handleContextMenu}
                className="h-32 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center cursor-pointer hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
              >
                <p className="text-sm font-medium text-center">
                  Top Edge
                  <br />
                  <span className="text-xs text-muted-foreground">Right-click me</span>
                </p>
              </div>

              {/* Top Right */}
              <div
                onContextMenu={handleContextMenu}
                className="h-32 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
              >
                <p className="text-sm font-medium text-center">
                  Top Right Corner
                  <br />
                  <span className="text-xs text-muted-foreground">Right-click me</span>
                </p>
              </div>

              {/* Middle Left */}
              <div
                onContextMenu={handleContextMenu}
                className="h-32 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors"
              >
                <p className="text-sm font-medium text-center">
                  Left Edge
                  <br />
                  <span className="text-xs text-muted-foreground">Right-click me</span>
                </p>
              </div>

              {/* Center */}
              <div
                onContextMenu={handleContextMenu}
                className="h-32 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center cursor-pointer hover:bg-pink-200 dark:hover:bg-pink-800 transition-colors"
              >
                <p className="text-sm font-medium text-center">
                  Center (Normal)
                  <br />
                  <span className="text-xs text-muted-foreground">Right-click me</span>
                </p>
              </div>

              {/* Middle Right */}
              <div
                onContextMenu={handleContextMenu}
                className="h-32 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
              >
                <p className="text-sm font-medium text-center">
                  Right Edge
                  <br />
                  <span className="text-xs text-muted-foreground">Right-click me</span>
                </p>
              </div>

              {/* Bottom Left */}
              <div
                onContextMenu={handleContextMenu}
                className="h-32 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
              >
                <p className="text-sm font-medium text-center">
                  Bottom Left Corner
                  <br />
                  <span className="text-xs text-muted-foreground">Right-click me</span>
                </p>
              </div>

              {/* Bottom Center */}
              <div
                onContextMenu={handleContextMenu}
                className="h-32 bg-teal-100 dark:bg-teal-900 rounded-lg flex items-center justify-center cursor-pointer hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors"
              >
                <p className="text-sm font-medium text-center">
                  Bottom Edge
                  <br />
                  <span className="text-xs text-muted-foreground">Right-click me</span>
                </p>
              </div>

              {/* Bottom Right */}
              <div
                onContextMenu={handleContextMenu}
                className="h-32 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
              >
                <p className="text-sm font-medium text-center">
                  Bottom Right Corner
                  <br />
                  <span className="text-xs text-muted-foreground">Right-click me</span>
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Test Instructions:</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>✓ Right-click each colored area to test edge detection</li>
                <li>✓ Menu should NEVER appear outside the viewport</li>
                <li>✓ Menu should NEVER crash or flicker</li>
                <li>✓ Try resizing your browser window and test again</li>
                <li>✓ Try on different screen sizes (mobile, tablet, desktop)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Context Menu */}
        {contextMenu && (
          <DropdownMenu
            open={!!contextMenu}
            onOpenChange={(open) => !open && setContextMenu(null)}
          >
            <PositionedDropdownMenuContent
              position={contextMenu}
              isOpen={!!contextMenu}
              className="w-56"
            >
              <DropdownMenuItem onClick={() => handleAction("View")}>
                <IconEye className="mr-2 h-4 w-4" />
                View Item
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction("Edit")}>
                <IconEdit className="mr-2 h-4 w-4" />
                Edit Item
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction("Copy")}>
                <IconCopy className="mr-2 h-4 w-4" />
                Duplicate Item
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleAction("Delete")}
                className="text-destructive"
              >
                <IconTrash className="mr-2 h-4 w-4" />
                Delete Item
              </DropdownMenuItem>
            </PositionedDropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

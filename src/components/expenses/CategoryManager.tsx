import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/useCategories";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  CheckCircle,
  XCircle,
} from "lucide-react";
import CategoryForm from "./CategoryForm";
import type { ExpenseCategory, CategoryFormData } from "@/types/expenses";

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
}

export default function CategoryManager({ open, onClose }: CategoryManagerProps) {
  const { toast } = useToast();
  const {
    categories,
    loading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  } = useCategories();

  // Modal states
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ExpenseCategory | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleCreate = () => {
    setEditingCategory(null);
    setShowCategoryForm(true);
  };

  const handleEdit = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setShowCategoryForm(true);
  };

  const handleCloseCategoryForm = () => {
    setShowCategoryForm(false);
    setEditingCategory(null);
  };

  const handleSubmit = async (data: CategoryFormData): Promise<ExpenseCategory | null> => {
    if (editingCategory) {
      const success = await updateCategory(editingCategory.id, data);
      return success ? editingCategory : null;
    }
    return createCategory(data);
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;

    const success = await deleteCategory(deletingCategory.id);
    if (success) {
      toast({
        title: "Category Deleted",
        description: `"${deletingCategory.name}" has been removed.`,
      });
    } else if (error) {
      toast({
        title: "Cannot Delete",
        description: error,
        variant: "destructive",
      });
    }
    setDeletingCategory(null);
  };

  // Drag handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      // Reorder the categories array
      const newOrder = [...categories];
      const [dragged] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(dragOverIndex, 0, dragged);

      // Save the new order
      const orderedIds = newOrder.map((c) => c.id);
      const success = await reorderCategories(orderedIds);

      if (success) {
        toast({
          title: "Order Updated",
          description: "Category order has been saved.",
        });
      }
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Create, edit, and organize expense categories. Drag to reorder.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Add Category Button */}
            <Button onClick={handleCreate} className="w-full mb-4">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>

            {/* Categories List */}
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading categories...
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No categories yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((category, index) => (
                  <div
                    key={category.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border bg-card
                      transition-all cursor-move
                      ${draggedIndex === index ? "opacity-50" : ""}
                      ${dragOverIndex === index && draggedIndex !== index ? "border-primary border-2" : ""}
                      hover:bg-muted/50
                    `}
                  >
                    {/* Drag Handle */}
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                    {/* Color Indicator */}
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />

                    {/* Category Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{category.name}</span>
                        {category.is_tax_deductible ? (
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                            Tax Deductible
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground flex-shrink-0">
                            <XCircle className="h-3 w-3 mr-1" />
                            Non-deductible
                          </Badge>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {category.description}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(category);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingCategory(category);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive mt-4">{error}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Form Modal */}
      <CategoryForm
        open={showCategoryForm}
        onClose={handleCloseCategoryForm}
        onSubmit={handleSubmit}
        category={editingCategory || undefined}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCategory?.name}"? This action cannot be
              undone. Categories with existing expenses cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

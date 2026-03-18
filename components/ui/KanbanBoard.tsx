"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  User, 
  X,
  Clock,
  CheckCircle2,
  FileText,
  GripVertical,
  Loader2,
  Filter
} from "lucide-react";
import { TaskStatus, TaskPriority } from "@/models/Task";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

interface Task {
  _id: string;
  title: string;
  desc?: string;
  note?: string;
  startDate: string;
  assignDate: string;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;
  assignee:
    | {
        _id: string;
        name: string;
        email: string;
      }
    | null;
  status: TaskStatus;
  priority: TaskPriority;
}

interface KanbanBoardProps {
  isAdmin: boolean;
  currentUserId?: string;
}

const statusConfig = {
  [TaskStatus.TODO]: { label: "To Do", color: "bg-gray-500/20 text-gray-400 border-gray-500/20" },
  [TaskStatus.IN_PROGRESS]: { label: "In Progress", color: "bg-blue-500/20 text-blue-400 border-blue-500/20" },
  [TaskStatus.IN_REVIEW]: { label: "In Review", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/20" },
  [TaskStatus.DONE]: { label: "Done", color: "bg-green-500/20 text-green-400 border-green-500/20" },
};

const priorityConfig = {
  [TaskPriority.LOW]: { label: "Low", color: "bg-blue-500/20 text-blue-400 border-blue-500/20" },
  [TaskPriority.MEDIUM]: { label: "Medium", color: "bg-gray-500/20 text-gray-400 border-gray-500/20" },
  [TaskPriority.HIGH]: { label: "High", color: "bg-orange-500/20 text-orange-400 border-orange-500/20" },
  [TaskPriority.URGENT]: { label: "Urgent", color: "bg-red-500/20 text-red-400 border-red-500/20" },
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Draggable Task Card Component
function TaskCard({ task, onEdit, onView, onDelete, isAdmin }: { 
  task: Task; 
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task._id,
    data: {
      type: "task",
      task,
    },
    disabled: !isAdmin,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      className={`p-4 bg-[#111] border rounded-xl hover:border-orange-500/30 transition-all cursor-pointer group relative ${
        isDragging ? "border-orange-500/50 shadow-lg" : "border-white/5"
      }`}
      onClick={() => isAdmin ? onEdit(task) : onView(task)}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-white group-hover:text-orange-500 transition-colors line-clamp-2 pr-6">
          {task.title}
        </h4>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded"
            title={isAdmin ? "Edit task" : "Add note"}
          >
            <Edit2 size={14} />
          </button>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task._id);
              }}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {task.desc && (
        <p className="text-xs text-gray-400 line-clamp-2 mb-3">{task.desc}</p>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <User size={12} />
          <span>{task.assignee?.name || task.assignee?.email || "Unassigned"}</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${priorityConfig[task.priority].color}`}>
          {priorityConfig[task.priority].label}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <Calendar size={12} />
          <span>Due: {formatDate(task.expectedDeliveryDate)}</span>
        </div>
        {isAdmin && (
          <div
            {...attributes}
            {...listeners}
            className="p-1 text-gray-500 hover:text-white cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={16} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Droppable Column Component
function Column({ 
  status, 
  tasks, 
  onEdit,
  onView,
  onDelete,
  isAdmin
}: { 
  status: TaskStatus; 
  tasks: Task[];
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}) {
  const config = statusConfig[status];
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: "column",
      status,
    },
    disabled: !isAdmin,
  });

  return (
    <div className="flex flex-col min-w-[280px]">
      <div className={`p-4 rounded-t-xl border ${config.color} mb-4`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{config.label}</h3>
          <span className="text-xs px-2 py-1 bg-white/10 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-3 flex-1 overflow-y-auto max-h-[1500px] custom-scrollbar min-h-[100px] rounded-b-xl transition-colors ${
          isOver ? "bg-orange-500/10 border-2 border-orange-500/50 border-dashed" : ""
        }`}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
            onEdit={onEdit}
            onView={onView}
            onDelete={onDelete}
            isAdmin={isAdmin}
          />
        ))}
        {tasks.length === 0 && (
          <div className={`p-8 text-center text-gray-500 text-sm border border-dashed rounded-xl ${
            isOver ? "border-orange-500/50" : "border-white/5"
          }`}>
            {isOver ? "Drop task here" : "No tasks"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ isAdmin, currentUserId }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    desc: "",
    note: "",
    startDate: "",
    assignDate: "",
    expectedDeliveryDate: "",
    actualDeliveryDate: "",
    assignee: "",
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
  });
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
      }
    } catch (err) {
      console.error("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users");
    }
  };

  useEffect(() => {
    fetchTasks();
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update task");

      // Optimistically update the task status in the local state
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task._id === taskId ? { ...task, status: newStatus } : task
        )
      );
    } catch (err: any) {
      alert(err.message);
      fetchTasks(); // Revert on error
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t._id === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    // Check if dropped on a valid column
    if (!Object.values(TaskStatus).includes(newStatus)) return;

    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistically update the UI
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t._id === taskId ? { ...t, status: newStatus } : t
      )
    );

    // Update the task status on the server
    await handleStatusChange(taskId, newStatus);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (editingTask) {
        // For editing
        if (isAdmin) {
          // Admin can edit everything
          const res = await fetch(`/api/tasks/${editingTask._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || "Something went wrong");
          }
        } else {
          // Regular users can only update the note
          const res = await fetch(`/api/tasks/${editingTask._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note: formData.note }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || "Something went wrong");
          }
        }
      } else {
        // Creating new task (admin only)
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Something went wrong");
        }
      }

      setShowModal(false);
      setEditingTask(null);
      setFormData({
        title: "",
        desc: "",
        note: "",
        startDate: "",
        assignDate: "",
        expectedDeliveryDate: "",
        actualDeliveryDate: "",
        assignee: "",
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
      });
      fetchTasks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      fetchTasks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setFormData({
      title: "",
      desc: "",
      note: "",
      startDate: "",
      assignDate: "",
      expectedDeliveryDate: "",
      actualDeliveryDate: "",
      assignee: currentUserId || "",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
    });
    setError("");
    setIsSubmitting(false);
    setShowModal(true);
  };

  const openViewModal = (task: Task) => {
    setViewingTask(task);
    setShowViewModal(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    if (isAdmin) {
      setFormData({
        title: task.title,
        desc: task.desc || "",
        note: task.note || "",
        startDate: task.startDate.split("T")[0],
        assignDate: task.assignDate.split("T")[0],
        expectedDeliveryDate: task.expectedDeliveryDate.split("T")[0],
        actualDeliveryDate: task.actualDeliveryDate ? task.actualDeliveryDate.split("T")[0] : "",
        assignee: task.assignee?._id || "",
        status: task.status,
        priority: task.priority,
      });
    } else {
      // For regular users, only allow editing the note
      setFormData({
        title: task.title,
        desc: task.desc || "",
        note: task.note || "",
        startDate: task.startDate.split("T")[0],
        assignDate: task.assignDate.split("T")[0],
        expectedDeliveryDate: task.expectedDeliveryDate.split("T")[0],
        actualDeliveryDate: task.actualDeliveryDate ? task.actualDeliveryDate.split("T")[0] : "",
        assignee: task.assignee?._id || "",
        status: task.status,
        priority: task.priority,
      });
    }
    setError("");
    setIsSubmitting(false);
    setShowModal(true);
  };


  const getTasksByStatus = (status: TaskStatus) => {
    let filteredTasks = tasks.filter((task) => task.status === status);
    
    // Filter by assignee if selected
    if (selectedAssigneeFilter) {
      filteredTasks = filteredTasks.filter(
        (task) => task.assignee?._id === selectedAssigneeFilter
      );
    }
    
    return filteredTasks;
  };

  // Get unique assignees from tasks
  const getUniqueAssignees = () => {
    const assigneeMap = new Map<string, { _id: string; name: string; email: string }>();
    tasks.forEach((task) => {
      if (!task.assignee?._id) return;
      if (!assigneeMap.has(task.assignee._id)) {
        assigneeMap.set(task.assignee._id, task.assignee);
      }
    });
    return Array.from(assigneeMap.values());
  };

  // Helper function to render task card for drag overlay
  const renderTaskCard = (task: Task | null) => {
    if (!task) return null;
    return (
      <div className="p-4 bg-[#111] border border-orange-500/50 rounded-xl shadow-2xl w-[280px]">
        <h4 className="font-medium text-white line-clamp-2 mb-2">{task.title}</h4>
        {task.desc && (
          <p className="text-xs text-gray-400 line-clamp-2 mb-2">{task.desc}</p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <User size={12} />
            <span>{task.assignee?.name || task.assignee?.email || "Unassigned"}</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${priorityConfig[task.priority].color}`}>
            {priorityConfig[task.priority].label}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const uniqueAssignees = getUniqueAssignees();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Task Board</h2>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Filter Dropdown */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <Filter size={18} className="text-gray-400" />
            <select
              value={selectedAssigneeFilter}
              onChange={(e) => setSelectedAssigneeFilter(e.target.value)}
              className="flex-1 sm:w-[200px] px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all appearance-none cursor-pointer"
            >
              <option value="" className="bg-[#111]">All Team Members</option>
              {uniqueAssignees.map((assignee) => (
                <option key={assignee._id} value={assignee._id} className="bg-[#111]">
                  {assignee.name || assignee.email}
                </option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openCreateModal}
              className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-700 text-white rounded-lg hover:from-orange-500 hover:to-amber-600 flex items-center gap-2 shadow-lg shadow-orange-500/20 whitespace-nowrap"
            >
              <Plus size={18} />
              New Task
            </motion.button>
          )}
        </div>
      </div>

      {isAdmin ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
            {Object.values(TaskStatus).map((status) => {
              const statusTasks = getTasksByStatus(status);
              return (
                <div
                  key={status}
                  data-status={status}
                  className="flex flex-col min-w-[280px]"
                >
                  <Column
                    status={status}
                    tasks={statusTasks}
                    onEdit={openEditModal}
                    onView={openViewModal}
                    onDelete={handleDelete}
                    isAdmin={isAdmin}
                  />
                </div>
              );
            })}
          </div>
          <DragOverlay>
            {activeTask ? renderTaskCard(activeTask) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
          {Object.values(TaskStatus).map((status) => {
            const statusTasks = getTasksByStatus(status);
            return (
              <div
                key={status}
                data-status={status}
                className="flex flex-col min-w-[280px]"
              >
                <Column
                  status={status}
                  tasks={statusTasks}
                  onEdit={openEditModal}
                  onView={openViewModal}
                  onDelete={handleDelete}
                  isAdmin={isAdmin}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Task Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl shadow-black/50 max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-8 pt-8 pb-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">
                      {editingTask 
                        ? (isAdmin ? "Edit Task" : "Add Note") 
                        : "Create New Task"}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {editingTask 
                        ? (isAdmin ? "Update task details below" : "Add or update your note")
                        : "Fill in the details to create a new task"}
                    </p>
                  </div>
                  <button
                    onClick={() => !isSubmitting && setShowModal(false)}
                    disabled={isSubmitting}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2"
                  >
                    <X size={16} />
                    {error}
                  </motion.div>
                )}

                <form id="task-form" onSubmit={handleSubmit} className="space-y-6">
                {editingTask && !isAdmin ? (
                  // Regular users can only add/edit notes
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                      <FileText size={16} className="text-orange-500" />
                      Note
                    </label>
                    <textarea
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none"
                      placeholder="Add your note here..."
                      rows={6}
                    />
                  </div>
                ) : (
                  <>
                    {/* Task Title */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                        <FileText size={16} className="text-orange-500" />
                        Task Title
                        <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Enter task title"
                        disabled={!!editingTask && !isAdmin}
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                        <FileText size={16} className="text-blue-500" />
                        Description
                        <span className="text-xs font-normal text-gray-500">(Optional)</span>
                      </label>
                      <textarea
                        value={formData.desc}
                        onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Enter task description"
                        rows={4}
                        disabled={!!editingTask && !isAdmin}
                      />
                    </div>

                    {/* Note (Edit Mode Only) */}
                    {editingTask && (
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                          <FileText size={16} className="text-yellow-500" />
                          Note
                          <span className="text-xs font-normal text-gray-500">(Optional)</span>
                        </label>
                        <textarea
                          value={formData.note}
                          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none"
                          placeholder="Additional notes"
                          rows={3}
                        />
                      </div>
                    )}
                  </>
                )}

                {(!editingTask || isAdmin) && (
                  <>
                    {/* Dates Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar size={18} className="text-orange-500" />
                        <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Dates</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-400">
                            Start Date
                            <span className="text-red-400 ml-1">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!!editingTask && !isAdmin}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-400">
                            Assign Date
                            <span className="text-red-400 ml-1">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={formData.assignDate}
                            onChange={(e) => setFormData({ ...formData, assignDate: e.target.value })}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!!editingTask && !isAdmin}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-400">
                          Expected Delivery Date
                          <span className="text-red-400 ml-1">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.expectedDeliveryDate}
                          onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!!editingTask && !isAdmin}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-400">
                          Actual Delivery Date
                        </label>
                        <input
                          type="date"
                          value={formData.actualDeliveryDate}
                          onChange={(e) => setFormData({ ...formData, actualDeliveryDate: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!!editingTask && !isAdmin}
                        />
                      </div>
                    </div>

                    {/* Assignment Section */}
                    {isAdmin && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                          <User size={18} className="text-orange-500" />
                          <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Assignment</h4>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-400">
                            Assignee
                            <span className="text-red-400 ml-1">*</span>
                          </label>
                          <select
                            required
                            value={formData.assignee}
                            onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all appearance-none cursor-pointer"
                          >
                            <option value="" className="bg-[#111]">Select assignee</option>
                            {users.map((user) => (
                              <option key={user._id} value={user._id} className="bg-[#111]">
                                {user.name || user.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Status & Priority Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 size={18} className="text-orange-500" />
                        <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Status & Priority</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-400">Status</label>
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!!editingTask && !isAdmin}
                          >
                            {Object.values(TaskStatus).map((status) => (
                              <option key={status} value={status} className="bg-[#111]">
                                {statusConfig[status].label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-400">Priority</label>
                          <select
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!!editingTask && !isAdmin}
                          >
                            {Object.values(TaskPriority).map((priority) => (
                              <option key={priority} value={priority} className="bg-[#111]">
                                {priorityConfig[priority].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                </form>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 border-t border-white/5 bg-white/5">
                <div className="flex justify-end gap-3">
                  <motion.button
                    type="button"
                    onClick={() => setShowModal(false)}
                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    form="task-form"
                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-700 text-white rounded-xl hover:from-orange-500 hover:to-amber-600 transition-all font-medium shadow-lg shadow-orange-500/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        {editingTask 
                          ? (isAdmin ? "Updating..." : "Saving...") 
                          : "Creating..."}
                      </>
                    ) : (
                      <>
                        {editingTask 
                          ? (isAdmin ? "Update Task" : "Save Note") 
                          : "Create Task"}
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Task Modal (for regular users) */}
      <AnimatePresence>
        {showViewModal && viewingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowViewModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl shadow-black/50 max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-8 pt-8 pb-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Task Details</h3>
                    <p className="text-sm text-gray-400">View task information</p>
                  </div>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
                <div className="space-y-6">
                  {/* Task Title */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                      <FileText size={16} className="text-orange-500" />
                      Task Title
                    </label>
                    <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white">
                      {viewingTask.title}
                    </div>
                  </div>

                  {/* Description */}
                  {viewingTask.desc && (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                        <FileText size={16} className="text-blue-500" />
                        Description
                      </label>
                      <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white whitespace-pre-wrap">
                        {viewingTask.desc}
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {viewingTask.note && (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                        <FileText size={16} className="text-yellow-500" />
                        Note
                      </label>
                      <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white whitespace-pre-wrap">
                        {viewingTask.note}
                      </div>
                    </div>
                  )}

                  {/* Dates Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={18} className="text-orange-500" />
                      <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Dates</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-400">Start Date</label>
                        <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white">
                          {formatDate(viewingTask.startDate)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-400">Assign Date</label>
                        <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white">
                          {formatDate(viewingTask.assignDate)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400">Expected Delivery Date</label>
                      <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white">
                        {formatDate(viewingTask.expectedDeliveryDate)}
                      </div>
                    </div>
                    {viewingTask.actualDeliveryDate && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-400">Actual Delivery Date</label>
                        <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white">
                          {formatDate(viewingTask.actualDeliveryDate)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assignment Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User size={18} className="text-orange-500" />
                      <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Assignment</h4>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400">Assignee</label>
                      <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        {viewingTask.assignee?.name ||
                          viewingTask.assignee?.email ||
                          "Unassigned"}
                      </div>
                    </div>
                  </div>

                  {/* Status & Priority Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 size={18} className="text-orange-500" />
                      <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Status & Priority</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-400">Status</label>
                        <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white">
                          {statusConfig[viewingTask.status].label}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-400">Priority</label>
                        <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                          <span className={`text-xs px-2 py-1 rounded-full ${priorityConfig[viewingTask.priority].color}`}>
                            {priorityConfig[viewingTask.priority].label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 border-t border-white/5 bg-white/5">
                <div className="flex justify-end gap-3">
                  <motion.button
                    type="button"
                    onClick={() => setShowViewModal(false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-2.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all font-medium"
                  >
                    Close
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => {
                      setShowViewModal(false);
                      openEditModal(viewingTask);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-700 text-white rounded-xl hover:from-orange-500 hover:to-amber-600 transition-all font-medium shadow-lg shadow-orange-500/20 flex items-center gap-2"
                  >
                    <Edit2 size={18} />
                    Add/Edit Note
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}


# Modern Chat Design System

## Color Palette

### Primary Colors
- **Blue Primary**: `from-blue-600 to-blue-700` - Used for sent messages and primary actions
- **Blue Secondary**: `blue-500` - Used for status indicators and accents
- **Blue Light**: `blue-50, blue-100, blue-200` - Used for hover states and backgrounds

### Neutral Colors
- **White**: `white, white/90, white/80` - Used for received messages and UI elements
- **Gray Scale**: `gray-50 to gray-900` - Used for text, borders, and backgrounds
- **Slate**: `slate-50, slate-100` - Used for subtle backgrounds

### Status Colors
- **Green**: `green-500` - Online status, delivered messages
- **Blue**: `blue-500` - Read receipts, typing indicators
- **Gray**: `gray-400` - Pending/sent status
- **Red**: `red-500` - Error states (not shown in current design)

## Typography

### Font Weights
- **Regular**: `font-normal` - Body text
- **Medium**: `font-medium` - Usernames, labels
- **Semibold**: `font-semibold` - Headers, important text

### Font Sizes
- **XS**: `text-xs` - Timestamps, character counts
- **Small**: `text-sm` - Messages on mobile, secondary text
- **Base**: `text-base` - Messages on desktop
- **Large**: `text-lg` - User names in header
- **XL**: `text-xl` - Empty state headers

## Spacing & Layout

### Message Bubbles
- **Padding**: `px-4 py-3` - Internal message padding
- **Max Width**: `max-w-[85%] sm:max-w-[70%]` - Responsive message width
- **Gap**: `gap-3` - Space between messages and avatars

### Containers
- **Header**: `px-4 sm:px-6 py-4` - Header padding
- **Messages**: `px-4 py-6 space-y-4` - Message area spacing
- **Input**: `p-4` - Input area padding

### Rounded Corners
- **Small**: `rounded-lg` - Small elements
- **Medium**: `rounded-xl` - Buttons, inputs
- **Large**: `rounded-2xl` - Message bubbles, main containers
- **Asymmetric**: `rounded-br-lg, rounded-bl-2xl` - Message bubble tails

## Shadows & Depth

### Subtle Shadows
- **Small**: `shadow-sm` - Avatars, small elements
- **Medium**: `shadow-md` - Message bubbles default
- **Large**: `shadow-lg` - Message bubbles on hover, input area
- **Extra Large**: `shadow-xl` - Container, buttons on hover
- **Double Extra Large**: `shadow-2xl` - Main container

### Borders
- **Light**: `border-gray-100, border-gray-200/50` - Subtle dividers
- **Focus**: `border-blue-300, border-blue-400` - Active states
- **Ring**: `ring-2 ring-white, ring-blue-200` - Focus rings

## Animation & Transitions

### Durations
- **Fast**: `duration-200` - Hover effects, button states
- **Standard**: `duration-300` - Message animations
- **Slow**: `1.4s` - Typing indicators

### Easings
- **Default**: `ease-out` - Most transitions
- **Bounce**: Built-in Tailwind bounce for typing dots

### Transforms
- **Scale**: `hover:scale-105, active:scale-95` - Interactive feedback
- **Hover**: `hover:scale-[1.02]` - Subtle message hover

## Interactive States

### Hover Effects
- **Buttons**: Background color change + scale
- **Messages**: Subtle scale + enhanced shadow
- **Input**: Border color change + background change

### Focus States
- **Input**: Ring + border color + background change
- **Buttons**: Ring + scale

### Active States
- **Buttons**: Scale down + visual feedback
- **Messages**: Maintain hover state

## Backdrop Effects

### Blur Effects
- **Header**: `backdrop-blur-md` - Semi-transparent header
- **Container**: `backdrop-blur-sm` - Subtle container blur
- **Input**: `backdrop-blur-md` - Input area blur

### Opacity Layers
- **Primary**: `bg-white/90` - Main transparency level
- **Secondary**: `bg-white/80` - Secondary transparency
- **Subtle**: `from-blue-50/30 via-white/50 to-slate-50/30` - Background gradients

## Responsive Design

### Breakpoints
- **Mobile**: Default styles, smaller text and spacing
- **Desktop**: `sm:` prefix for larger screens

### Text Scaling
- **Messages**: `text-sm sm:text-base` - Responsive font size
- **Containers**: `max-w-4xl` on desktop, full width on mobile

## Accessibility

### Focus Management
- **Visible Focus**: Ring indicators on all interactive elements
- **Keyboard Navigation**: Tab order and focus trapping
- **Screen Readers**: Proper ARIA labels and semantic markup

### Color Contrast
- **Text**: High contrast ratios maintained
- **Interactive Elements**: Clear visual feedback
- **Status Indicators**: Distinct colors and shapes

## Component Hierarchy

1. **Container** - Main chat wrapper with gradient background
2. **Header** - User info, back button, status
3. **Messages Area** - Scrollable message list with subtle pattern
4. **Message Bubbles** - Individual messages with status
5. **Input Area** - Message composition with send button

## Visual Enhancements

### Gradient Backgrounds
- **Container**: `bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50`
- **Messages**: `bg-gradient-to-br from-blue-600 to-blue-700`
- **Send Button**: `bg-gradient-to-r from-blue-600 to-blue-700`

### Pattern Overlays
- **Subtle Dots**: SVG pattern for visual texture without distraction
- **Low Opacity**: Maintains readability while adding depth

### Status Indicators
- **Online Dot**: Green circle with white border
- **Typing Animation**: Three bouncing blue dots
- **Message Status**: Clock, check, double-check icons
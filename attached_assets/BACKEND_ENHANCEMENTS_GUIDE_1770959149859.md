# Backend Enhancements Guide - Admin Portal System

This document outlines all the backend enhancements made to the Admin Portal system. Use this guide to implement the same features in another project.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Firebase Collections Structure](#firebase-collections-structure)
3. [User Hierarchy & Permissions](#user-hierarchy--permissions)
4. [Authentication System](#authentication-system)
5. [Brand Management System](#brand-management-system)
6. [Team Member System](#team-member-system)
7. [Brand URLs Management](#brand-urls-management)
8. [Cart & Order System](#cart--order-system)
9. [Payment Methods](#payment-methods)
10. [Site Settings & Content Management](#site-settings--content-management)
11. [API Endpoints Reference](#api-endpoints-reference)
12. [Key Code Snippets](#key-code-snippets)

---

## Architecture Overview

### Technology Stack
- **Backend**: Node.js + Express
- **Database**: Firebase Firestore (for admin portal data)
- **Authentication**: Custom JWT-based authentication (stored in localStorage)
- **File Location**: All backend logic in `server/notification-service.ts` and `server/routes.ts`

### Key Design Patterns
1. **Firebase Admin SDK**: All Firebase operations use the server-side Admin SDK
2. **JWT Authentication**: Custom tokens created with email and userLevel
3. **Lazy Initialization**: Firebase is initialized only when needed
4. **Collection-based Data**: Each feature uses its own Firestore collection

---

## Firebase Collections Structure

### `admin_portal_users` Collection
Stores all portal users (admins, creators, team members).

```typescript
interface AdminPortalUser {
  id: string;              // Document ID
  email: string;           // User's email (lowercase)
  displayName: string;     // Display name
  passwordHash: string;    // bcrypt hashed password
  userLevel: number;       // 1=Team Member, 2=Creator, 3=Admin
  creatorId?: string;      // For team members: their creator's ID
  invitedBy?: string;      // For team members: who invited them
  firebaseUid?: string;    // Optional Firebase Auth UID
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### `brands` Collection
Stores brand information.

```typescript
interface Brand {
  id: string;              // Document ID
  brandName: string;       // Brand display name (migrated from 'name')
  name: string;            // Original name field (kept for compatibility)
  normalizedName: string;  // Lowercase name for searching
  description?: string;
  thumbnailUrl?: string;
  creator?: string | null; // Creator name who owns this brand
  isPartner: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### `brand_urls` Collection
Stores URLs associated with brands.

```typescript
interface BrandUrl {
  id: string;
  brandId: string;         // Reference to brand document ID
  urlType: string;         // 'images_short_data', 'brand_video', 'chronic_tv_catalog'
  urlValue: string;        // The actual URL
  label?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### `user_carts` Collection
Stores shopping cart data per user.

```typescript
interface CartItem {
  productId: string;
  productName: string;
  productType: 'product' | 'service';
  price: number;
  quantity: number;
  scheduledDate?: string;
  scheduledTime?: string;
  imageUrl?: string;
  addedAt: string;
}

interface UserCart {
  userId: string;
  items: CartItem[];
  updatedAt: Timestamp;
}
```

### `orders` Collection
Stores completed orders.

```typescript
interface Order {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  transactionId?: string;
  proofImageUrl?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### `payment_methods` Collection
Stores available payment options.

```typescript
interface PaymentMethod {
  id: string;
  name: string;            // 'Cash App', 'Zelle', etc.
  instructions: string;    // Payment instructions
  accountInfo: string;     // Account details (handle, email, etc.)
  isActive: boolean;
  sortOrder: number;
  createdAt: Timestamp;
}
```

### `site_settings` Collection
Stores site-wide configuration.

```typescript
interface SiteSettings {
  siteName: string;
  tagline: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  socialLinks: { platform: string; url: string }[];
  businessHours: string;
}
```

---

## User Hierarchy & Permissions

### User Levels
```typescript
const USER_LEVELS = {
  TEAM_MEMBER: 1,  // Can view/manage their creator's brand
  CREATOR: 2,      // Can manage their brands, add team members
  ADMIN: 3         // Full access to everything
};
```

### Permission Logic
```typescript
// Check if user is admin
const isAdmin = adminUser.userLevel === 3;

// Check if user is creator
const isCreator = adminUser.userLevel === 2;

// Check if user is team member
const isTeamMember = adminUser.userLevel === 1;
```

---

## Authentication System

### Password Hashing
```typescript
import bcrypt from 'bcryptjs';

// Hash password
const passwordHash = await bcrypt.hash(password, 10);

// Verify password
const isValid = await bcrypt.compare(password, user.passwordHash);
```

### JWT Token Creation
```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Create token
const token = jwt.sign(
  { 
    email: user.email, 
    userId: user.id,
    userLevel: user.userLevel 
  },
  JWT_SECRET,
  { expiresIn: '7d' }
);
```

### Token Verification (in routes)
```typescript
const authHeader = req.headers.authorization;
if (!authHeader?.startsWith('Bearer ')) {
  res.status(401).json({ message: "Missing authorization header" });
  return;
}

const token = authHeader.split('Bearer ')[1];
const tokenParts = token.split('.');
if (tokenParts.length !== 3) {
  res.status(401).json({ message: "Invalid token format" });
  return;
}

const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
const email = payload.email;
```

### Login Endpoint
```typescript
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  
  const user = await authenticateAdminPortalUser(email.toLowerCase(), password);
  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }
  
  const token = jwt.sign(
    { email: user.email, userId: user.id, userLevel: user.userLevel },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  res.json({ token, user });
});
```

---

## Brand Management System

### Brand-Creator Relationship
Brands are linked to creators via the `creator` field in the brands collection.

```typescript
// Assign brand to creator
export async function assignBrandToCreator(brandId: string, creatorName: string): Promise<boolean> {
  const firestore = admin.firestore();
  
  await firestore.collection('brands').doc(brandId).update({
    creator: creatorName,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return true;
}

// Get brands for a creator
export async function getCreatorBrandsFromFirebase(creatorId: string): Promise<CreatorBrand[]> {
  const firestore = admin.firestore();
  const brands: CreatorBrand[] = [];
  
  // Get creator's display name
  const creatorDoc = await firestore.collection('admin_portal_users').doc(creatorId).get();
  const creatorName = creatorDoc.exists ? creatorDoc.data()?.displayName : null;
  
  // Find brands where creator field matches
  const brandsSnapshot = await firestore.collection('brands').get();
  brandsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.creator === creatorName) {
      brands.push({
        id: doc.id,
        creatorId: creatorId,
        brandName: data.brandName || data.name || '',
        brandDescription: data.description,
        createdAt: data.createdAt?.toDate?.()?.toISOString()
      });
    }
  });
  
  return brands;
}
```

### Brand Migration (name → brandName)
```typescript
export async function migrateBrandsCollection(): Promise<{ migrated: number, errors: string[] }> {
  const firestore = admin.firestore();
  const snapshot = await firestore.collection('brands').get();
  
  let migrated = 0;
  const errors: string[] = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates: Record<string, any> = {};
    
    // Copy name to brandName if needed
    if (data.name && !data.brandName) {
      updates.brandName = data.name;
    }
    
    // Add creator field if missing
    if (data.creator === undefined) {
      updates.creator = null;
    }
    
    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      migrated++;
    }
  }
  
  return { migrated, errors };
}
```

---

## Team Member System

### Creating Team Members
Team members are sub-accounts under a creator.

```typescript
export async function createTeamMember(
  creatorId: string, 
  invitedBy: string, 
  memberData: { name: string; email: string; password: string }
): Promise<AdminPortalUser | null> {
  const firestore = admin.firestore();
  
  // Check if email already exists
  const existingSnapshot = await firestore.collection('admin_portal_users')
    .where('email', '==', memberData.email.toLowerCase())
    .get();
    
  if (!existingSnapshot.empty) {
    throw new Error('Email already exists');
  }
  
  const passwordHash = await bcrypt.hash(memberData.password, 10);
  
  const docRef = await firestore.collection('admin_portal_users').add({
    email: memberData.email.toLowerCase(),
    displayName: memberData.name,
    passwordHash,
    userLevel: 1,  // Team member level
    creatorId,     // Link to their creator
    invitedBy,     // Who created this account
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return {
    id: docRef.id,
    email: memberData.email.toLowerCase(),
    displayName: memberData.name,
    userLevel: 1,
    creatorId,
    invitedBy,
    createdAt: new Date().toISOString()
  };
}

// Get team members for a creator
export async function getTeamMembersByCreator(creatorId: string): Promise<TeamMember[]> {
  const firestore = admin.firestore();
  
  const snapshot = await firestore.collection('admin_portal_users')
    .where('creatorId', '==', creatorId)
    .where('userLevel', '==', 1)
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
```

---

## Brand URLs Management

### URL Types
- `images_short_data` - Image and Public Data folder
- `brand_video` - Brand trailer/video
- `chronic_tv_catalog` - Content catalog spreadsheet

### Add/Update Brand URL (Upsert Pattern)
```typescript
export async function addBrandUrlInFirebase(urlData: {
  brandId: string;
  urlType: string;
  urlValue: string;
  label?: string;
}): Promise<BrandUrl | null> {
  const firestore = admin.firestore();
  
  // Check if URL of this type already exists
  const existingSnapshot = await firestore.collection('brand_urls')
    .where('brandId', '==', urlData.brandId)
    .where('urlType', '==', urlData.urlType)
    .get();
  
  // If exists, update instead of creating duplicate
  if (!existingSnapshot.empty) {
    const existingDoc = existingSnapshot.docs[0];
    await existingDoc.ref.update({
      urlValue: urlData.urlValue,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      id: existingDoc.id,
      ...urlData,
      createdAt: existingDoc.data().createdAt?.toDate?.()?.toISOString()
    };
  }
  
  // Create new document
  const docRef = await firestore.collection('brand_urls').add({
    brandId: urlData.brandId,
    urlType: urlData.urlType,
    urlValue: urlData.urlValue,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return {
    id: docRef.id,
    ...urlData,
    createdAt: new Date().toISOString()
  };
}
```

---

## Cart & Order System

### Add to Cart
```typescript
export async function addToCart(userId: string, item: CartItem): Promise<UserCart | null> {
  const firestore = admin.firestore();
  const cartRef = firestore.collection('user_carts').doc(userId);
  const cartDoc = await cartRef.get();
  
  let items: CartItem[] = [];
  
  if (cartDoc.exists) {
    items = cartDoc.data()?.items || [];
  }
  
  // Check if item already exists
  const existingIndex = items.findIndex(i => i.productId === item.productId);
  if (existingIndex >= 0) {
    items[existingIndex].quantity += item.quantity;
  } else {
    items.push({
      ...item,
      addedAt: new Date().toISOString()
    });
  }
  
  await cartRef.set({
    userId,
    items,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  return { userId, items, updatedAt: new Date().toISOString() };
}
```

### Create Order with Payment Proof
```typescript
export async function createOrderWithProof(orderData: {
  userId: string;
  userEmail: string;
  userName?: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  transactionId?: string;
  proofImageUrl?: string;
}): Promise<Order | null> {
  const firestore = admin.firestore();
  
  const docRef = await firestore.collection('orders').add({
    ...orderData,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Clear user's cart after order
  await clearCart(orderData.userId);
  
  return {
    id: docRef.id,
    ...orderData,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
}
```

---

## Payment Methods

### Get Active Payment Methods
```typescript
export async function getActivePaymentMethods(): Promise<PaymentMethod[]> {
  const firestore = admin.firestore();
  
  const snapshot = await firestore.collection('payment_methods')
    .where('isActive', '==', true)
    .orderBy('sortOrder', 'asc')
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
```

### Create Payment Method
```typescript
export async function createPaymentMethod(data: {
  name: string;
  instructions: string;
  accountInfo: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<PaymentMethod | null> {
  const firestore = admin.firestore();
  
  const docRef = await firestore.collection('payment_methods').add({
    ...data,
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder ?? 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { id: docRef.id, ...data };
}
```

---

## Site Settings & Content Management

### Site Settings CRUD
```typescript
export async function getSiteSettings(): Promise<SiteSettings | null> {
  const firestore = admin.firestore();
  const doc = await firestore.collection('site_settings').doc('main').get();
  
  if (!doc.exists) return null;
  return doc.data() as SiteSettings;
}

export async function saveSiteSettings(data: SiteSettings): Promise<boolean> {
  const firestore = admin.firestore();
  
  await firestore.collection('site_settings').doc('main').set({
    ...data,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  return true;
}
```

---

## API Endpoints Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Login with email/password |
| POST | `/api/admin/verify` | Verify JWT token |
| POST | `/api/admin/change-password` | Change user password |
| PUT | `/api/admin/profile` | Update user profile |

### Creators & Team Members
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/creators` | Get all creators |
| POST | `/api/admin/create-creator` | Create new creator account |
| GET | `/api/admin/team-members` | Get team members for current creator |
| POST | `/api/admin/team-members` | Add team member |
| DELETE | `/api/admin/team-members/:id` | Remove team member |

### Brands
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/brands` | Get all brands |
| GET | `/api/admin/creator/:id/brands` | Get brands for creator |
| POST | `/api/admin/creator/:id/brands` | Assign brands to creator |
| POST | `/api/admin/migrate-brands` | Run brand migration |

### Brand URLs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/brand/:brandId/urls` | Get URLs for brand |
| POST | `/api/admin/brand/:brandId/urls` | Add/update brand URL |
| DELETE | `/api/admin/brand-url/:urlId` | Delete brand URL |

### Cart & Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cart` | Get user's cart |
| POST | `/api/cart/add` | Add item to cart |
| PUT | `/api/cart/update` | Update cart item quantity |
| DELETE | `/api/cart/remove/:productId` | Remove from cart |
| POST | `/api/orders` | Create order |
| GET | `/api/orders` | Get user's orders |
| GET | `/api/admin/orders` | Get all orders (admin) |

### Payment Methods
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payment-methods` | Get active payment methods |
| GET | `/api/admin/payment-methods` | Get all payment methods |
| POST | `/api/admin/payment-methods` | Create payment method |
| PUT | `/api/admin/payment-methods/:id` | Update payment method |
| DELETE | `/api/admin/payment-methods/:id` | Delete payment method |

### Site Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/site-settings` | Get site settings |
| PUT | `/api/admin/site-settings` | Update site settings |

---

## Key Code Snippets

### Firebase Admin Initialization
```typescript
import admin from 'firebase-admin';

let firebaseInitialized = false;

function initializeFirebaseAdmin(): boolean {
  if (firebaseInitialized) return true;
  
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    
    firebaseInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    return false;
  }
}
```

### Standard Route Pattern
```typescript
app.post("/api/admin/some-action", async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: "Missing authorization header" });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const email = payload.email;

    // 2. Get user and check permissions
    const { getAdminPortalUserByEmail } = await import('./notification-service');
    const adminUser = await getAdminPortalUserByEmail(email.toLowerCase());
    
    if (!adminUser) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    // 3. Check user level if needed
    if (adminUser.userLevel !== 3) {
      res.status(403).json({ message: "Admin access required" });
      return;
    }

    // 4. Perform action
    const { someFunction } = await import('./notification-service');
    const result = await someFunction(req.body);

    // 5. Return response
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Action error:", error);
    res.status(500).json({ message: error.message || "Failed to perform action" });
  }
});
```

---

## Required Dependencies

```json
{
  "dependencies": {
    "firebase-admin": "^12.x",
    "bcryptjs": "^2.x",
    "jsonwebtoken": "^9.x",
    "express": "^4.x"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.x",
    "@types/jsonwebtoken": "^9.x"
  }
}
```

---

## Environment Variables

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
JWT_SECRET=your-secret-key
```

---

## Implementation Checklist

1. [ ] Set up Firebase Admin SDK with service account
2. [ ] Create `admin_portal_users` collection structure
3. [ ] Implement authentication (login, JWT, password hashing)
4. [ ] Create user level system (Admin=3, Creator=2, TeamMember=1)
5. [ ] Implement brand management (add brandName and creator fields)
6. [ ] Run brand migration to add brandName/creator fields
7. [ ] Implement team member system
8. [ ] Add brand URLs management with upsert pattern
9. [ ] Implement cart system
10. [ ] Implement order system with payment proof
11. [ ] Add payment methods management
12. [ ] Add site settings management

---

---

## Frontend Admin Dashboard Patterns

### Authentication Context
```typescript
// Store token in localStorage
localStorage.setItem('adminToken', token);

// Get token for API calls
const token = localStorage.getItem('adminToken');

// Include in fetch headers
fetch('/api/admin/some-endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Tab-Based Navigation
The admin dashboard uses a tab-based navigation system:
```typescript
const [activeTab, setActiveTab] = useState('dashboard');

// Tabs available based on user level
const adminTabs = ['dashboard', 'creators', 'brands', 'orders', 'settings'];
const creatorTabs = ['dashboard', 'team', 'purchase-history', 'account'];
```

### React Query Patterns
```typescript
// Fetch data
const { data: brands = [], refetch: refetchBrands } = useQuery({
  queryKey: ['admin-brands'],
  queryFn: async () => {
    const response = await fetch('/api/admin/brands');
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  }
});

// Mutation with cache invalidation
const createMutation = useMutation({
  mutationFn: async (data) => {
    const token = localStorage.getItem('adminToken');
    const response = await fetch('/api/admin/endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed');
    return response.json();
  },
  onSuccess: () => {
    refetchData(); // Refetch related data
    setMessage({ type: 'success', text: 'Success!' });
  },
  onError: (error) => {
    setMessage({ type: 'error', text: error.message });
  }
});
```

### Form State Pattern
```typescript
const [formData, setFormData] = useState({
  name: '',
  email: '',
  password: ''
});

// Update form field
onChange={(e) => setFormData(prev => ({ 
  ...prev, 
  name: e.target.value 
}))}

// Reset form after success
setFormData({ name: '', email: '', password: '' });
```

### Message Feedback Pattern
```typescript
const [message, setMessage] = useState<{ 
  type: 'success' | 'error', 
  text: string 
} | null>(null);

// Show message and auto-hide
setMessage({ type: 'success', text: 'Saved!' });
setTimeout(() => setMessage(null), 5000);

// Display in JSX
{message && (
  <div className={`p-3 rounded-lg ${
    message.type === 'success' 
      ? 'bg-green-500/10 text-green-400' 
      : 'bg-red-500/10 text-red-400'
  }`}>
    {message.text}
  </div>
)}
```

---

## Key UI Components

### Creator Dashboard Sections
1. **Dashboard** - Welcome message, brand cards with quick actions
2. **Team** - Add/manage team members, share login link
3. **Purchase History** - View past orders
4. **Account** - Profile settings, password change

### Admin Dashboard Sections
1. **Dashboard** - Analytics, member counts
2. **Creators** - Create/manage creator accounts, assign brands
3. **Brands** - View all brands, configure brand URLs
4. **Orders** - View all orders, update status
5. **Settings** - Site settings, payment methods

### Brand Card Component Pattern
```jsx
<div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
  <div className="flex items-center gap-4">
    {brand.thumbnailUrl && (
      <img src={brand.thumbnailUrl} className="w-16 h-16 rounded-lg" />
    )}
    <div>
      <h3 className="text-lg font-semibold">{brand.brandName}</h3>
      <p className="text-sm text-zinc-400">{brand.description}</p>
    </div>
  </div>
  
  {/* Expandable sections */}
  <div className="mt-4 space-y-2">
    <button onClick={() => toggleSection('urls')}>
      Brand URLs
    </button>
    {expandedSection === 'urls' && (
      <div>/* URL management content */</div>
    )}
  </div>
</div>
```

---

This guide provides all the patterns and code needed to replicate the admin portal backend in another project.

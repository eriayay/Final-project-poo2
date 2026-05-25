import { useState } from "react";
import { Navigation } from "./components/layout/Navigation";
import { UserShop } from "./components/shop/UserShop";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { ProductForm } from "./components/admin/ProductForm";
import { ShoppingCart, CartItem } from "./components/shop/ShoppingCart";
import { useEffect } from "react";
import { AuthModal } from "./components/auth/AuthModal";
import { Product } from "./components/shop/ProductCard";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { apiConfig } from "./config/api";


export default function App() {
  const [currentView, setCurrentView] = useState<'user' | 'admin'>('user');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [userStats, setUserStats] = useState({ active_users: 0, users_joined_this_month: 0, increment: 0 });
  const [salesStats, setSalesStats] = useState({ 
    this_month_revenue: 0,
    last_month_revenue: 0,
    revenue_percentage: 0,
    this_month_orders: 0,
    last_month_orders: 0,
    orders_percentage: 0
  });

  
const fetchProducts = async () => {
      try {
        const response = await fetch(apiConfig.endpoints.products);
        if (!response.ok) throw new Error("Failed to fetch products");
        const data: Product[] = await response.json();

        const formattedProducts: Product[] = data.map((p: any) => ({
          id: p.id.toString(),
          name: p.nombre,
          description: p.descripcion,
          category: p.tipo,
          price: parseFloat(p.precio),
          stock: p.stock,
          condition: p.condicion,
          image: p.imagen || undefined 
        }));

        setProducts(formattedProducts); // actualizar estado
      } catch (error) {
        console.error(error);
      }
    };

  const fetchAllOrders = async () => {
    try {
      const response = await fetch(apiConfig.endpoints.orders);
      if (!response.ok) throw new Error("Failed to fetch orders");
      const data = await response.json();
      setAllOrders(data);
    } catch (error) {
      console.error("Error fetching all orders:", error);
      setAllOrders([]);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await fetch(apiConfig.endpoints.statsUsers);
      if (!response.ok) throw new Error("Failed to fetch user stats");
      const data = await response.json();
      setUserStats(data);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      setUserStats({ active_users: 0, users_joined_this_month: 0, increment: 0 });
    }
  };

  const fetchSalesStats = async () => {
    try {
      const response = await fetch(apiConfig.endpoints.statsSales);
      if (!response.ok) throw new Error("Failed to fetch sales stats");
      const data = await response.json();
      setSalesStats(data);
    } catch (error) {
      console.error("Error fetching sales stats:", error);
      setSalesStats({ 
        this_month_revenue: 0,
        last_month_revenue: 0,
        revenue_percentage: 0,
        this_month_orders: 0,
        last_month_orders: 0,
        orders_percentage: 0
      });
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchAllOrders();
    fetchUserStats();
    fetchSalesStats();

    // Auto-refresh orders and stats every 30 seconds (but not products)
    const refreshInterval = setInterval(() => {
      fetchAllOrders();
      fetchUserStats();
      fetchSalesStats();
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, []);


  // Authentication state
  const [user, setUser] = useState<{
    username: string;
    email?: string;
    userType: 'user' | 'admin';
  } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Authentication handlers
  const handleLogin = (username: string, userType: 'user' | 'admin') => {
    setUser({ username, userType });
    setCurrentView(userType === 'admin' ? 'admin' : 'user');
    setIsAuthModalOpen(false);
  };

  const handleRegister = (username: string, email: string) => {
    setUser({ username, email, userType: 'user' });
    setCurrentView('user');
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
    setCart([]);
    setCurrentView('user');
    setIsCartOpen(false);
    setIsProductFormOpen(false);
    setEditingProduct(null);
    toast.success('Logged out successfully');
  };

  const handleOpenAuthModal = () => {
    setIsAuthModalOpen(true);
    setAuthView('login');
  };
  
  const handleAddToCart = (product: Product) => {
    if (!user) {
      handleOpenAuthModal();
      toast.error('Please sign in to add items to your cart');
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity < product.stock) {
          return prevCart.map(item =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        } else {
          toast.error('Not enough stock available');
          return prevCart;
        }
      } else {
        toast.success('Added to cart');
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    if (quantity === 0) {
      handleRemoveFromCart(productId);
      return;
    }
    
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
    toast.success('Removed from cart');
  };

  const handleCheckout = async () => {
    if (!user) {
      toast.error("⚠️ You must be logged in to place an order.");
      return;
    }
    
    try {
    const response = await fetch(apiConfig.endpoints.ordersCreate, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usuario: user.username,
        items: cart.map(item => ({
          producto_id: item.id,
          cantidad: item.quantity,
        })),
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("Pedido creado:", data);
      toast.success('Order placed successfully!');
      setCart([]);
      setIsCartOpen(false);
      await fetchProducts();
      if (user?.username) {
        await fetchUserOrders(user.username);
      }
      
    } else {
      toast.error("❌ Error: " + data.error);
    }
  } catch (err) {
    console.error(err);
    toast.error("⚠️ Error connecting to server");
  }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsProductFormOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsProductFormOpen(true);
  };

  const handleSaveProduct = async (productData: any) => {
    try {
      const formData = new FormData();
      formData.append("nombre", productData.name);
      formData.append("descripcion", productData.description);
      formData.append("tipo", productData.category);
      formData.append("precio", productData.price.toString());
      formData.append("stock", productData.stock.toString());
      formData.append("condicion", productData.condition);

      if (productData.imageFile) {
        formData.append("imagen", productData.imageFile); // imagen del input file
      }

      let response: Response;

      if (editingProduct) {
        // editar producto
        response = await fetch(apiConfig.endpoints.productsEdit(editingProduct.id), {
          method: "POST",
          body: formData
        });
      } else {
        // crear producto
        response = await fetch(apiConfig.endpoints.productsCreate, {
          method: "POST",
          body: formData
        });
      }

      if (!response.ok) throw new Error("Failed to save product");

      const savedProduct = await response.json();

      const formattedProduct: Product = {
        id: savedProduct.id.toString(),
        name: savedProduct.nombre,
        description: savedProduct.descripcion,
        category: savedProduct.tipo,
        price: parseFloat(savedProduct.precio),
        stock: savedProduct.stock,
        condition: savedProduct.condicion,
        image: savedProduct.imagen || ""
      };

      if (editingProduct) {
        setProducts(prev =>
          prev.map(p => (p.id === editingProduct.id ? formattedProduct : p))
        );
        toast.success("Product updated successfully");
      } else {
        setProducts(prev => [...prev, formattedProduct]);
        toast.success("Product added successfully");
      }

      setIsProductFormOpen(false);
      setEditingProduct(null);

    } catch (error) {
      console.error(error);
      toast.error("Error saving product");
    }
    
  };

  const fetchUserOrders = async (username?: string) => {
    if (!username) {
      setUserOrders([]);
      return;
    }
    try {
      const res = await fetch(apiConfig.endpoints.ordersByUser(username));
      if (!res.ok) {
        console.error("Failed to fetch user orders", await res.text());
        setUserOrders([]);
        return;
      }
      const data = await res.json();
      setUserOrders(data);
    } catch (err) {
      console.error("Error fetching user orders:", err);
      setUserOrders([]);
    }
  };

  useEffect(() => {
    if (user?.username) {
      fetchUserOrders(user.username);
    } else {
      setUserOrders([]);
    }
  }, [user]);


  return (
    <div className="min-h-screen bg-background">
      <Navigation
        currentView={currentView}
        onViewChange={(view) => {
          // Only allow admin view if user is admin
          if (view === 'admin' && user?.userType !== 'admin') {
            toast.error('Access denied. Admin privileges required.');
            return;
          }
          setCurrentView(view);
        }}
        cartItemCount={cartItemCount}
        onCartClick={() => setIsCartOpen(true)}
        user={user}
        onLogout={handleLogout}
        onLoginClick={handleOpenAuthModal}
      />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {currentView === 'user' ? (
          <UserShop
            products={products}
            cart={cart}
            onAddToCart={handleAddToCart}
            userOrders={user ? userOrders : undefined}
            isAuthenticated={!!user}
          />
        ) : (
          <AdminDashboard
            products={products}
            sales={allOrders}
            userStats={userStats}
            salesStats={salesStats}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onStatusUpdated={() => {
              fetchAllOrders();
              if (user) {
                fetchUserOrders(user.username);
              }
            }}
          />
        )}
      </main>

      <ShoppingCart
        items={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onCheckout={handleCheckout}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />

      <ProductForm
        product={editingProduct}
        isOpen={isProductFormOpen}
        onClose={() => setIsProductFormOpen(false)}
        onSave={handleSaveProduct}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
        initialView={authView}
      />

      <Toaster />
    </div>
  );
}
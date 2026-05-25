import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AlertCircle, TrendingUp, Package, DollarSign } from "lucide-react";
import { apiConfig } from "../../config/api";

interface VeganStoreDetail {
  item_id: number;
  producto_nombre: string;
  proveedor_nombre: string;
  stock: number;
  precio_unitario: string;
  valor_total_item: string;
}

interface VeganStoreData {
  titulo: string;
  fecha_generacion: string;
  resumen: {
    total_skus: number;
    total_unidades_stock: number;
    valor_total_inventario: number | string;
  };
  detalle: VeganStoreDetail[];
}

interface VeganStoreReportProps {
  apiUrl?: string;
}

export function VeganStoreReport({ apiUrl = apiConfig.endpoints.tiendaVegana }: VeganStoreReportProps) {
  const [data, setData] = useState<VeganStoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!apiUrl) {
          throw new Error("API URL no configurada para Tienda Vegana");
        }
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch vegan store data");
        }
        const jsonData = await response.json();
        setData(jsonData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiUrl]);

  if (!apiUrl) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          VITE_TIENDA_VEGANA_URL no está configurada en las variables de entorno
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error || "No data available"}
        </AlertDescription>
      </Alert>
    );
  }

  // Prepare data for charts
  const stockBySupplier = data.detalle.reduce((acc, item) => {
    const existing = acc.find(s => s.proveedor === item.proveedor_nombre);
    if (existing) {
      existing.stock += item.stock;
      existing.count += 1;
    } else {
      acc.push({
        proveedor: item.proveedor_nombre,
        stock: item.stock,
        count: 1,
      });
    }
    return acc;
  }, [] as Array<{ proveedor: string; stock: number; count: number }>);

  const stockByProduct = data.detalle.map(item => ({
    name: item.producto_nombre.length > 25 ? item.producto_nombre.substring(0, 25) + "..." : item.producto_nombre,
    stock: item.stock,
  }));

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{data.titulo}</h2>
        <p className="text-sm text-gray-500 mt-1">
          Generado: {new Date(data.fecha_generacion).toLocaleString("es-CO")}
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SKUs Totales</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.resumen.total_skus}</div>
            <p className="text-xs text-gray-500">productos diferentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unidades en Stock</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.resumen.total_unidades_stock.toLocaleString("es-CO")}</div>
            <p className="text-xs text-gray-500">unidades disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Inventario</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.resumen.valor_total_inventario)}</div>
            <p className="text-xs text-gray-500">inventario completo</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock by Supplier */}
        <Card>
          <CardHeader>
            <CardTitle>Stock por Proveedor</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stockBySupplier}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="proveedor" angle={-45} textAnchor="end" height={80} fontSize={12} />
                <YAxis />
                <Tooltip formatter={(value) => [value, "Unidades"]} />
                <Bar dataKey="stock" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stock Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Stock por Producto (Top 6)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stockByProduct.slice(0, 6)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, stock }) => `${name}: ${stock}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="stock"
                >
                  {stockByProduct.slice(0, 6).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, "Unidades"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Inventario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Precio Unitario</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.detalle.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.item_id}</TableCell>
                    <TableCell>{item.producto_nombre}</TableCell>
                    <TableCell>{item.proveedor_nombre}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{item.stock}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.precio_unitario)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.valor_total_item)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

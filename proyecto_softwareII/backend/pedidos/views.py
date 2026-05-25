from django.shortcuts import render
from django.contrib.auth.models import User, Group
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login
from django.conf import settings
from django.db import models
from django.db.models import Sum
import json
from .models import Pedido, Producto, DetallePedido
from decimal import Decimal
from datetime import datetime, timedelta
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .serializers import PedidoExportSerializer


@csrf_exempt  
def register_user(request):
    if request.method == "POST":
        data = json.loads(request.body)
        username = data.get("username")
        email = data.get("email")
        first_name = data.get("first_name", "")
        last_name = data.get("last_name", "")
        password = data.get("password")
        
        if User.objects.filter(username=username).exists():
            return JsonResponse({"error": "Username already exists"}, status=400)
        if User.objects.filter(email=email).exists():
            return JsonResponse({"error": "Email already exists"}, status=400)
        
        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            password=password
        )

        # Asignar grupo "Cliente" por defecto
        cliente_group = Group.objects.get(name="Cliente")
        user.groups.add(cliente_group)
        user.save()

        return JsonResponse({"message": "User registered successfully"})
    return JsonResponse({"error": "Invalid request"}, status=400)

@csrf_exempt
def login_user(request):
    if request.method == "POST":
        data = json.loads(request.body)
        identifier = data.get("identifier")
        password = data.get("password")

        user = None
        try: #Mira si se logeo con usuario
            user_obj = User.objects.get(username=identifier)
            user = authenticate(request, username=user_obj.username, password=password)
        except User.DoesNotExist:
            try: #Mira si se logeo con email
                user_obj = User.objects.get(email=identifier)
                user = authenticate(request, username=user_obj.username, password=password)
            except User.DoesNotExist:
                return JsonResponse({"error": "Invalid credentials"}, status=400)

        if user is not None:
            login(request, user)  # crea sesión
                # Determinar tipo de usuario
            user_type = "admin" if user.groups.filter(name="Trabajador").exists() else "user"
            return JsonResponse({"message": "Login successful", "userType": user_type, "username": user.username})
            
        return JsonResponse({"error": "Invalid credentials"}, status=400)

    return JsonResponse({"error": "Invalid request"}, status=400)

def get_products(request):
    if request.method == "GET":
        products = Producto.objects.all()
        formatted_products = []
        for p in products:
            formatted_products.append({
                "id": p.id,
                "nombre": p.nombre,
                "descripcion": p.descripcion,
                "tipo": p.tipo,
                "precio": str(p.precio),
                "stock": p.stock,
                "condicion": p.condicion,
                # Construimos la URL completa de la imagen
                "imagen": request.build_absolute_uri(p.imagen.url) if p.imagen else None
            })
        return JsonResponse(formatted_products, safe=False)
    return JsonResponse({"error": "Invalid request"}, status=400)

@csrf_exempt
def create_product(request):
    if request.method == "POST":
        nombre = request.POST.get("nombre")
        descripcion = request.POST.get("descripcion")
        tipo = request.POST.get("tipo")
        precio = request.POST.get("precio")
        stock = request.POST.get("stock")
        condicion = request.POST.get("condicion")
        imagen = request.FILES.get("imagen")  # <-- aquí recibimos la imagen

        producto = Producto.objects.create(
            nombre=nombre,
            descripcion=descripcion,
            tipo=tipo,
            precio=precio,
            stock=stock,
            condicion=condicion,
            imagen=imagen
        )

        return JsonResponse({
            "id": producto.id,
            "nombre": producto.nombre,
            "descripcion": producto.descripcion,
            "tipo": producto.tipo,
            "precio": str(producto.precio),
            "stock": producto.stock,
            "condicion": producto.condicion,
            "imagen": request.build_absolute_uri(producto.imagen.url) if producto.imagen else None
        })

    return JsonResponse({"error": "Invalid request"}, status=400)

@csrf_exempt
def edit_product(request, product_id):
    if request.method == "POST":  # cambiamos a POST para recibir FormData fácilmente
        producto = Producto.objects.get(pk=product_id)

        producto.nombre = request.POST.get("nombre", producto.nombre)
        producto.descripcion = request.POST.get("descripcion", producto.descripcion)
        producto.tipo = request.POST.get("tipo", producto.tipo)
        producto.precio = request.POST.get("precio", producto.precio)
        producto.stock = request.POST.get("stock", producto.stock)
        producto.condicion = request.POST.get("condicion", producto.condicion)
        if request.FILES.get("imagen"):
            producto.imagen = request.FILES.get("imagen")

        producto.save()

        return JsonResponse({
            "id": producto.id,
            "nombre": producto.nombre,
            "descripcion": producto.descripcion,
            "tipo": producto.tipo,
            "precio": str(producto.precio),
            "stock": producto.stock,
            "condicion": producto.condicion,
            "imagen": request.build_absolute_uri(producto.imagen.url) if producto.imagen else None
        })

    return JsonResponse({"error": "Invalid request"}, status=400)

@csrf_exempt
def create_order(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            username = data.get("usuario")
            usuario = User.objects.get(username=username)

            pedido = Pedido.objects.create(usuario=usuario, estado="pendiente", total=0)

            total = Decimal("0.00")

            for item in data.get("items", []):
                producto = Producto.objects.get(pk=item["producto_id"])
                cantidad = int(item["cantidad"])
                subtotal = producto.precio * cantidad

                DetallePedido.objects.create(
                    pedido=pedido,
                    producto=producto,
                    cantidad=cantidad,
                    subtotal=subtotal
                )

                # Restar stock
                producto.stock -= cantidad
                producto.save()

                total += subtotal

            # Guardar total en el pedido
            pedido.total = total
            pedido.save()

            return JsonResponse({
                "id": pedido.id,
                "usuario": pedido.usuario.username,
                "estado": pedido.estado,
                "total": str(pedido.total),
                "fecha_pedido": pedido.fecha_pedido.strftime("%Y-%m-%d %H:%M:%S"),
                "detalles": [
                    {
                        "producto": detalle.producto.nombre,
                        "cantidad": detalle.cantidad,
                        "subtotal": str(detalle.subtotal)
                    }
                    for detalle in pedido.detalles.all()
                ]
            })

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Invalid request"}, status=400)

@csrf_exempt
def get_user_orders(request, username):
    if request.method != "GET":
        return JsonResponse({"error": "Invalid request"}, status=400)

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({"error": "Usuario no encontrado"}, status=404)

    pedidos = Pedido.objects.filter(usuario=user).order_by("-fecha_pedido")

    result = []
    for pedido in pedidos:
        items = []

        for detalle in pedido.detalles.all():
            items.append({
                "productName": detalle.producto.nombre,
                "quantity": detalle.cantidad,
                "price": float(detalle.producto.precio),   # precio unitario
                "subtotal": float(detalle.subtotal)
            })

        result.append({
            "id": pedido.id,
            "date": pedido.fecha_pedido.strftime("%Y-%m-%d %H:%M:%S"),
            "total": float(pedido.total) if pedido.total is not None else 0.0,
            "status": pedido.estado,
            "items": items
        })

    return JsonResponse(result, safe=False)

@csrf_exempt
def get_all_orders(request):
    """Obtiene todos los pedidos para el dashboard del admin"""
    if request.method != "GET":
        return JsonResponse({"error": "Invalid request"}, status=400)

    try:
        pedidos = Pedido.objects.all().order_by("-fecha_pedido")

        result = []
        for pedido in pedidos:
            items = []

            for detalle in pedido.detalles.all():
                items.append({
                    "id": f"sale{detalle.id}",
                    "orderId": f"order{pedido.id}",
                    "productId": str(detalle.producto.id),
                    "productName": detalle.producto.nombre,
                    "quantity": detalle.cantidad,
                    "price": float(detalle.producto.precio),
                    "date": pedido.fecha_pedido.strftime("%Y-%m-%d"),
                    "customerName": f"{pedido.usuario.first_name} {pedido.usuario.last_name}".strip() or pedido.usuario.username,
                    "status": pedido.estado
                })

            for sale in items:
                result.append(sale)

        return JsonResponse(result, safe=False)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
def get_user_stats(request):
    """Obtiene estadísticas de usuarios para el dashboard"""
    if request.method != "GET":
        return JsonResponse({"error": "Invalid request"}, status=400)

    try:
        # Contar todos los usuarios activos (sin restricción de fecha)
        active_users = User.objects.filter(is_active=True).count()
        
        # Calcular usuarios agregados en el mes actual vs mes pasado
        today = datetime.now().date()
        first_day_this_month = today.replace(day=1)
        
        # Primer día del mes pasado
        if first_day_this_month.month == 1:
            first_day_last_month = first_day_this_month.replace(year=first_day_this_month.year - 1, month=12)
        else:
            first_day_last_month = first_day_this_month.replace(month=first_day_this_month.month - 1)
        
        # Último día del mes pasado
        last_day_last_month = first_day_this_month - timedelta(days=1)
        
        # Usuarios activos agregados en el mes pasado
        users_joined_last_month = User.objects.filter(
            date_joined__date__gte=first_day_last_month,
            date_joined__date__lte=last_day_last_month,
            is_active=True
        ).count()
        
        return JsonResponse({
            "active_users": active_users,
            "users_joined_this_month": users_joined_last_month,
            "increment": users_joined_last_month
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
def get_sales_stats(request):
    """Obtiene estadísticas de ventas para el dashboard"""
    if request.method != "GET":
        return JsonResponse({"error": "Invalid request"}, status=400)

    try:
        today = datetime.now().date()
        current_month = today.month
        current_year = today.year
        
        # Mes pasado
        if current_month == 1:
            last_month = 12
            last_year = current_year - 1
        else:
            last_month = current_month - 1
            last_year = current_year
        
        # Ingresos del mes actual (por mes de calendario, sin restricción de año)
        this_month_revenue = Pedido.objects.filter(
            fecha_pedido__month=current_month
        ).aggregate(total=Sum('total'))['total'] or Decimal('0')
        
        # Ingresos del mes pasado (por mes de calendario)
        last_month_revenue = Pedido.objects.filter(
            fecha_pedido__month=last_month
        ).aggregate(total=Sum('total'))['total'] or Decimal('0')
        
        # Pedidos del mes actual
        this_month_orders = Pedido.objects.filter(
            fecha_pedido__month=current_month
        ).count()
        
        # Pedidos del mes pasado
        last_month_orders = Pedido.objects.filter(
            fecha_pedido__month=last_month
        ).count()
        
        # Calcular porcentajes
        revenue_percentage = 0.0
        if float(last_month_revenue) > 0:
            revenue_percentage = ((float(this_month_revenue) - float(last_month_revenue)) / float(last_month_revenue)) * 100
        elif float(this_month_revenue) > 0:
            revenue_percentage = 100.0
        
        orders_percentage = 0.0
        if last_month_orders > 0:
            orders_percentage = ((this_month_orders - last_month_orders) / last_month_orders) * 100
        elif this_month_orders > 0:
            orders_percentage = 100.0
        
        return JsonResponse({
            "this_month_revenue": float(this_month_revenue),
            "last_month_revenue": float(last_month_revenue),
            "revenue_percentage": round(revenue_percentage, 1),
            "this_month_orders": this_month_orders,
            "last_month_orders": last_month_orders,
            "orders_percentage": round(orders_percentage, 1)
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
def update_order_status(request):
    """Actualiza el estado de un pedido"""
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    try:
        data = json.loads(request.body)
        order_id = data.get("orderId")
        new_status = data.get("status")
        
        # Validar que el estado sea válido
        valid_statuses = ['pendiente', 'completado', 'cancelado']
        if new_status not in valid_statuses:
            return JsonResponse({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}, status=400)
        
        # Obtener el pedido y actualizar su estado
        try:
            # El orderId viene como "order{id}", necesitamos extraer el id
            pedido_id = order_id.replace("order", "")
            pedido = Pedido.objects.get(id=pedido_id)
            pedido.estado = new_status
            pedido.save()
            
            return JsonResponse({
                "message": "Order status updated successfully",
                "orderId": order_id,
                "status": pedido.estado
            })
        except Pedido.DoesNotExist:
            return JsonResponse({"error": "Order not found"}, status=404)
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@api_view(['GET'])
def export_orders(request):
    """
    Exporta todas las órdenes en formato JSON.
    
    GET /api/orders/export/
    
    Parámetros opcionales de consulta:
    - username: Filtrar órdenes de un usuario específico
    - estado: Filtrar por estado (pendiente, completado, cancelado)
    - fecha_inicio: Filtrar órdenes posteriores a esta fecha (formato: YYYY-MM-DD)
    - fecha_fin: Filtrar órdenes anteriores a esta fecha (formato: YYYY-MM-DD)
    
    Retorna array de órdenes:
    [
        {
            "id": int,
            "usuario": int,
            "usuario_username": str,
            "usuario_email": str,
            "usuario_nombre": str,
            "usuario_apellido": str,
            "usuario_nombre_completo": str,
            "fecha_pedido": datetime,
            "estado": str,
            "total": str,
            "detalles": [...]
        }
    ]
    """
    try:
        # Obtener parámetros de filtro
        username = request.query_params.get('username')
        estado = request.query_params.get('estado')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')
        
        # Construir queryset con filtros
        queryset = Pedido.objects.all()
        
        if username:
            queryset = queryset.filter(usuario__username__icontains=username)
        
        if estado:
            queryset = queryset.filter(estado__iexact=estado)
        
        if fecha_inicio:
            try:
                fecha_inicio = datetime.strptime(fecha_inicio, '%Y-%m-%d').date()
                queryset = queryset.filter(fecha_pedido__date__gte=fecha_inicio)
            except ValueError:
                return Response(
                    {"error": "Invalid fecha_inicio format. Use YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if fecha_fin:
            try:
                fecha_fin = datetime.strptime(fecha_fin, '%Y-%m-%d').date()
                queryset = queryset.filter(fecha_pedido__date__lte=fecha_fin)
            except ValueError:
                return Response(
                    {"error": "Invalid fecha_fin format. Use YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Ordenar por fecha descendente
        queryset = queryset.order_by('-fecha_pedido')
        
        # Serializar todas las órdenes (sin paginación)
        serializer = PedidoExportSerializer(queryset, many=True)
        
        return Response(serializer.data)
    
    except Exception as e:
        return Response(
            {"error": f"Error exporting orders: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST
        )

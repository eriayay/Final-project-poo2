from rest_framework import serializers
from .models import Pedido, DetallePedido, Producto
from django.contrib.auth.models import User


class ProductoDetailSerializer(serializers.ModelSerializer):
    """Serializer para detalles de productos en órdenes"""
    class Meta:
        model = Producto
        fields = ['id', 'nombre', 'precio', 'tipo', 'condicion']


class DetallePedidoSerializer(serializers.ModelSerializer):
    """Serializer para detalles de pedidos"""
    producto = ProductoDetailSerializer(read_only=True)
    producto_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = DetallePedido
        fields = ['id', 'producto', 'producto_id', 'cantidad', 'subtotal']


class DetallePedidoImportSerializer(serializers.ModelSerializer):
    """Serializer para importar detalles de pedidos"""
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    
    class Meta:
        model = DetallePedido
        fields = ['cantidad', 'subtotal', 'producto_nombre']


class PedidoSerializer(serializers.ModelSerializer):
    """Serializer para pedidos con detalles completos"""
    usuario_username = serializers.CharField(source='usuario.username', read_only=True)
    usuario_email = serializers.CharField(source='usuario.email', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    detalles = DetallePedidoSerializer(many=True, read_only=True)
    
    class Meta:
        model = Pedido
        fields = [
            'id', 
            'usuario', 
            'usuario_username', 
            'usuario_email',
            'usuario_nombre',
            'fecha_pedido', 
            'estado', 
            'total',
            'detalles'
        ]
        read_only_fields = ['id', 'fecha_pedido', 'usuario']
    
    def get_usuario_nombre(self, obj):
        """Retorna el nombre completo del usuario"""
        if obj.usuario.first_name and obj.usuario.last_name:
            return f"{obj.usuario.first_name} {obj.usuario.last_name}"
        return obj.usuario.username


class PedidoExportSerializer(serializers.ModelSerializer):
    """Serializer para exportar pedidos con toda la información"""
    usuario_username = serializers.CharField(source='usuario.username', read_only=True)
    usuario_email = serializers.CharField(source='usuario.email', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    usuario_apellido = serializers.SerializerMethodField()
    usuario_nombre_completo = serializers.SerializerMethodField()
    detalles = serializers.SerializerMethodField()
    
    class Meta:
        model = Pedido
        fields = [
            'id', 
            'usuario',
            'usuario_username', 
            'usuario_email',
            'usuario_nombre',
            'usuario_apellido',
            'usuario_nombre_completo',
            'fecha_pedido', 
            'estado', 
            'total',
            'detalles'
        ]
    
    def get_usuario_nombre(self, obj):
        """Retorna el nombre del usuario"""
        return obj.usuario.first_name or obj.usuario.username
    
    def get_usuario_apellido(self, obj):
        """Retorna el apellido del usuario"""
        return obj.usuario.last_name or ""
    
    def get_usuario_nombre_completo(self, obj):
        """Retorna el nombre completo del usuario"""
        if obj.usuario.first_name and obj.usuario.last_name:
            return f"{obj.usuario.first_name} {obj.usuario.last_name}"
        return obj.usuario.username
    
    def get_detalles(self, obj):
        """Retorna los detalles del pedido de forma más detallada"""
        detalles = obj.detalles.all()
        return [
            {
                'id': detalle.id,
                'producto_id': detalle.producto.id,
                'producto_nombre': detalle.producto.nombre,
                'producto_tipo': detalle.producto.tipo,
                'producto_condicion': detalle.producto.condicion,
                'cantidad': detalle.cantidad,
                'precio_unitario': str(detalle.producto.precio),
                'subtotal': str(detalle.subtotal)
            }
            for detalle in detalles
        ]


class PedidoImportSerializer(serializers.Serializer):
    """Serializer para importar pedidos desde otros proyectos"""
    usuario_username = serializers.CharField(max_length=150, required=True)
    usuario_email = serializers.EmailField(required=False, allow_blank=True)
    usuario_nombre = serializers.CharField(max_length=150, required=False, allow_blank=True)
    usuario_apellido = serializers.CharField(max_length=150, required=False, allow_blank=True)
    fecha_pedido = serializers.DateTimeField(required=False)
    estado = serializers.CharField(max_length=50, required=False, default='pendiente')
    total = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    detalles = serializers.ListField(
        child=serializers.DictField(),
        required=True
    )
    
    def validate_detalles(self, value):
        """Valida que al menos haya un detalle"""
        if not value:
            raise serializers.ValidationError("La orden debe tener al menos un detalle.")
        
        for detalle in value:
            if 'producto_nombre' not in detalle or 'cantidad' not in detalle or 'subtotal' not in detalle:
                raise serializers.ValidationError(
                    "Cada detalle debe tener 'producto_nombre', 'cantidad' y 'subtotal'."
                )
        
        return value
    
    def create(self, validated_data):
        """
        NO guarda nada en BD, solo valida y retorna los datos.
        Este método es llamado por la vista después de que el serializer valida.
        """
        # Simplemente retornar los datos validados sin guardar en BD
        return validated_data

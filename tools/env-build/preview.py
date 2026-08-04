# Renders a preview of a built set.glb with a truck-sized proxy box at the
# origin, so layout, scale and materials can be judged without launching the app.
#
#   blender -b -P preview.py -- <set.glb> <out.png> [camX camY camZ tgtX tgtY tgtZ]
#
# The proxy is 2.9 x 19.0 x 4.2 m — a Scania tractor plus the 15 m trailer,
# measured off the app's own GLBs. If the proxy looks wrong against a building,
# the layout is wrong, not the render.
import bpy, sys, os, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SET = argv[0]
OUT = argv[1]
cam = [float(v) for v in argv[2:5]] if len(argv) >= 5 else [34.0, -40.0, 13.0]
tgt = [float(v) for v in argv[5:8]] if len(argv) >= 8 else [0.0, 8.0, 2.0]
proxy_y = float(argv[8]) if len(argv) >= 9 else 6.0   # rig centre along +Y

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SET)

# truck proxy
me = bpy.data.meshes.new("TRUCK_PROXY")
ob = bpy.data.objects.new("TRUCK_PROXY", me)
bpy.context.collection.objects.link(ob)
import bmesh
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Identity(4))
bmesh.ops.scale(bm, vec=(2.9, 19.0, 4.2), verts=bm.verts)
bmesh.ops.translate(bm, vec=(0.0, proxy_y, 2.1), verts=bm.verts)
bm.to_mesh(me); bm.free()
m = bpy.data.materials.new("PROXY"); m.use_nodes = True
m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.85, 0.12, 0.10, 1)
me.materials.append(m)

# sun + sky, roughly the app's `ensolarado` key (az 38, el 52)
sun_data = bpy.data.lights.new("Sun", type="SUN")
sun_data.energy = 3.2
sun_data.angle = math.radians(1.5)
sun = bpy.data.objects.new("Sun", sun_data)
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(38.0), 0.0, math.radians(125.0))

w = bpy.data.worlds.new("W"); bpy.context.scene.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.42, 0.58, 0.82, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.1

cam_data = bpy.data.cameras.new("Cam"); cam_data.lens = 40.0
cam_ob = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam_ob)
cam_ob.location = Vector(cam)
d = Vector(tgt) - Vector(cam)
cam_ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam_ob

sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in \
    [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
sc.render.resolution_x = 1280
sc.render.resolution_y = 720
sc.render.film_transparent = False
sc.view_settings.view_transform = "AgX" if "AgX" in \
    [i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("[preview] wrote " + OUT)

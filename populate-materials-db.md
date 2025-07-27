-- --- 2. Populate public.units_of_measure ---
WITH inserted_units AS (
    INSERT INTO public.units_of_measure (name, description) VALUES
    ('m2', 'Square Meter'),
    ('Pce', 'Piece'),
    ('box', 'Box'),
    ('m3', 'Cubic Meter'),
    ('ml', 'Milliliter'),
    ('Kg', 'Kilogram'),
    ('Roll', 'Roll'),
    ('Sheet', 'Sheet'),
    ('Ltr', 'Liter'),
    ('Can', 'Can'),
    ('Set', 'Set'),
    ('Bag', 'Bag'),
    ('Mtr', 'Meter'),
    ('Pcs', 'Pieces'),
    ('cm', 'Centimeter'),
    ('m', 'Meter (linear)'),
    ('hour', 'Hour'),
    ('trip', 'Trip')
    ON CONFLICT (name) DO NOTHING
    RETURNING id, name
)
SELECT * FROM inserted_units;



-- --- 4. Populate public.suppliers ---
WITH inserted_suppliers AS (
    INSERT INTO public.suppliers (name, contact_info) VALUES
    ('IPAC', '{"phone": "123-456-7890", "email": "contact@ipac.com"}'),
    ('SAS', '{"phone": "987-654-3210", "email": "sales@sas.net"}'),
    ('ZOOM', '{"phone": "555-111-2222", "email": "info@zoom.org"}'),
    ('ALU', '{"phone": "111-222-3333", "email": "support@alu.com"}'),
    ('SAINT-GOBAIN', '{"phone": "444-555-6666", "email": "sales@saintgobain.com"}'),
    ('BAK', '{"phone": "777-888-9999", "email": "contact@bak.com"}'),
    ('ALUCOBOND', '{"phone": "333-444-5555", "email": "info@alucobond.com"}'),
    ('GULF', '{"phone": "666-777-8888", "email": "sales@gulf.net"}'),
    ('DUBAI', '{"phone": "222-333-4444", "email": "support@dubai.org"}'),
    ('Logistics Co A', '{"phone": "999-000-1111", "email": "info@logisticsA.com"}') -- New supplier for transportation
    ON CONFLICT (name) DO NOTHING
    RETURNING id, name
)
SELECT * FROM inserted_suppliers;



-- --- 5. Populate public.materials ---
WITH inserted_materials AS (
    INSERT INTO public.materials (name, description) VALUES
    ('Plywood', 'General category for wooden panels made from thin layers of wood veneer.'),
    ('Tarpaulin', 'Heavy-duty waterproof cloth.'),
    ('MDF', 'Medium-density fiberboard.'),
    ('Wood', 'General category for timber and lumber.'),
    ('Screws', 'Fasteners with a helical ridge.'),
    ('Polypropylene', 'Thermoplastic polymer used for various sheets.'),
    ('Heat Shrink Film', 'Film that shrinks when heated, often for protection.'),
    ('Tyvek', 'High-density polyethylene fibers, often used for protective covers.'),
    ('Carton', 'Cardboard material.'),
    ('LVL', 'Laminated Veneer Lumber, an engineered wood product.'),
    ('Triplex Carton', 'Thick, multi-layered cardboard.'),
    ('Flexible Foam', 'Soft, pliable foam for cushioning.'),
    ('Expanded Polystyren', 'Lightweight foam for insulation and cushioning.'),
    ('Rubber', 'Elastic material for cushioning or sealing.'),
    ('Carpet', 'Soft floor covering, used for protection.'),
    ('Mesh', 'Net-like material.'),
    ('PlexiGlass', 'Transparent acrylic sheet.'),
    ('Silica Gel', 'Desiccant for moisture absorption.'),
    ('Bolts', 'Threaded fasteners used with nuts.'),
    ('Nuts', 'Fasteners with a threaded hole, used with bolts.'),
    ('Washers', 'Thin plates used to distribute load of a threaded fastener.'),
    ('Staples', 'U-shaped fasteners.'),
    ('Nails', 'Metal fasteners driven into material.'),
    ('Strapping', 'Flat material used to bundle items.'),
    ('Bands', 'Flexible strips for securing.'),
    ('Adhesive Tape', 'Sticky tape for sealing/joining.'),
    ('Glue', 'Adhesive substance.'),
    ('Desiccant', 'Substance to absorb moisture.'),
    ('VCI Film', 'Volatile Corrosion Inhibitor film.'),
    ('Aluminum Foil', 'Thin metal sheet for barrier protection.'),
    ('Bubble Wrap', 'Plastic sheeting with air-filled bubbles for cushioning.'),
    ('Polyethylene Film', 'Common plastic film for wrapping.'),
    ('Stretch Film', 'Elastic plastic film for wrapping and securing.'),
    ('Foam Sheets', 'Sheets of foam for cushioning.'),
    ('High Density Foam', 'Dense foam for structural support or heavy cushioning.'),
    ('BlueUFoam', 'Specific type of foam for cushioning.'),
    ('Transportation', 'Cost associated with moving goods or services.') -- New material for transportation
    ON CONFLICT (name) DO NOTHING
    RETURNING id, name
)
SELECT * FROM inserted_materials;


-- --- 6. Populate public.material_variants ---
WITH
    m AS (SELECT id, name FROM public.materials),
    u AS (SELECT id, name FROM public.units_of_measure)
INSERT INTO public.material_variants (material_id, variant_name, attributes) VALUES
-- Plywood
((SELECT id FROM m WHERE name = 'Plywood'), 'Plywood - 09mm', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 9}'),
((SELECT id FROM m WHERE name = 'Plywood'), 'Plywood - 12mm', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 12}'),
((SELECT id FROM m WHERE name = 'Plywood'), 'Plywood - 18mm', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 18}'),
((SELECT id FROM m WHERE name = 'Plywood'), 'Plywood - 09mm Marine', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 9, "type": "Marine"}'),
((SELECT id FROM m WHERE name = 'Plywood'), 'Plywood - 12mm Marine', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 12, "type": "Marine"}'),
((SELECT id FROM m WHERE name = 'Plywood'), 'Plywood - 18mm Marine', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 18, "type": "Marine"}'),

-- Tarpaulin
((SELECT id FROM m WHERE name = 'Tarpaulin'), 'Tarpaulin - 200gsm', '{"gsm": 200}'),
((SELECT id FROM m WHERE name = 'Tarpaulin'), 'Tarpaulin - 300gsm', '{"gsm": 300}'),
((SELECT id FROM m WHERE name = 'Tarpaulin'), 'Tarpaulin - 400gsm', '{"gsm": 400}'),

-- MDF
((SELECT id FROM m WHERE name = 'MDF'), 'MDF - 06mm', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 6}'),
((SELECT id FROM m WHERE name = 'MDF'), 'MDF - 09mm', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 9}'),
((SELECT id FROM m WHERE name = 'MDF'), 'MDF - 12mm', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 12}'),
((SELECT id FROM m WHERE name = 'MDF'), 'MDF - 18mm', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 18}'),

-- Wood
((SELECT id FROM m WHERE name = 'Wood'), 'Wood Length 400cm x 10x14', '{"length_cm": 400, "width_cm": 10, "thickness_cm": 14}'),
((SELECT id FROM m WHERE name = 'Wood'), 'Wood 2.5x5c (1''x2'')', '{"length_cm": 400, "width_cm": 2.5, "thickness_cm": 5}'),
((SELECT id FROM m WHERE name = 'Wood'), 'Wood 5x7.5c (2''x3'')', '{"length_cm": 400, "width_cm": 5, "thickness_cm": 7.5}'),
((SELECT id FROM m WHERE name = 'Wood'), 'Wood 10x10c (4''x4'')', '{"length_cm": 400, "width_cm": 10, "thickness_cm": 10}'),
((SELECT id FROM m WHERE name = 'Wood'), 'Wood 10x14c (4''x6'')', '{"length_cm": 400, "width_cm": 10, "thickness_cm": 14}'),
((SELECT id FROM m WHERE name = 'Wood'), 'Wood 14x14c (6''x6'')', '{"length_cm": 400, "width_cm": 14, "thickness_cm": 14}'),
((SELECT id FROM m WHERE name = 'Wood'), 'Wood 14x16c (6''x8'')', '{"length_cm": 400, "width_cm": 14, "thickness_cm": 16}'),

-- Screws
((SELECT id FROM m WHERE name = 'Screws'), 'Screws 5x80', '{"diameter_mm": 5, "length_mm": 80}'),
((SELECT id FROM m WHERE name = 'Screws'), 'Screws 5x60', '{"diameter_mm": 5, "length_mm": 60}'),
((SELECT id FROM m WHERE name = 'Screws'), 'Screws 6x100', '{"diameter_mm": 6, "length_mm": 100}'),
((SELECT id FROM m WHERE name = 'Screws'), 'Screws 6x120', '{"diameter_mm": 6, "length_mm": 120}'),

-- Polypropylene
((SELECT id FROM m WHERE name = 'Polypropylene'), 'Polypropylene 3mm', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 3}'),
((SELECT id FROM m WHERE name = 'Polypropylene'), 'Polypropylene 5mm', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 5}'),

-- Heat Shrink Film
((SELECT id FROM m WHERE name = 'Heat Shrink Film'), 'Heat Shrink Film 7ml', '{"thickness_ml": 7, "length_m": 100, "type": "VCI"}'),
((SELECT id FROM m WHERE name = 'Heat Shrink Film'), 'Heat Shrink Film 10ml', '{"thickness_ml": 10, "length_m": 100, "type": "VCI"}'),
((SELECT id FROM m WHERE name = 'Heat Shrink Film'), 'Heat Shrink Film 12ml', '{"thickness_ml": 12, "length_m": 100, "type": "VCI"}'),

-- Tyvek
((SELECT id FROM m WHERE name = 'Tyvek'), 'Tyvek for Fine Art Only', '{"gsm": 400, "application": "Fine Art"}'),
((SELECT id FROM m WHERE name = 'Tyvek'), 'Tyvek 200gsm', '{"gsm": 200}'),

-- Carton
((SELECT id FROM m WHERE name = 'Carton'), 'Carton Roll 100cm', '{"width_cm": 100, "form": "Roll"}'),
((SELECT id FROM m WHERE name = 'Carton'), 'Carton Sheet 122x244', '{"length_cm": 244, "width_cm": 122, "form": "Sheet"}'),

-- LVL
((SELECT id FROM m WHERE name = 'LVL'), 'LVL 38x90x6000', '{"length_mm": 6000, "width_mm": 38, "thickness_mm": 90}'),
((SELECT id FROM m WHERE name = 'LVL'), 'LVL 38x140x6000', '{"length_mm": 6000, "width_mm": 38, "thickness_mm": 140}'),

-- Triplex Carton
((SELECT id FROM m WHERE name = 'Triplex Carton'), 'Triplex Carton 15mm', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 15}'),
((SELECT id FROM m WHERE name = 'Triplex Carton'), 'Triplex Carton 20mm', '{"length_cm": 244, "width_cm": 122, "thickness_mm": 20}'),

-- Flexible Foam
((SELECT id FROM m WHERE name = 'Flexible Foam'), 'Flexible Foam 05mm', '{"thickness_mm": 5, "form": "Roll"}'),
((SELECT id FROM m WHERE name = 'Flexible Foam'), 'Flexible Foam 10mm', '{"thickness_mm": 10, "form": "Roll"}'),
((SELECT id FROM m WHERE name = 'Flexible Foam'), 'Flexible Foam 20mm', '{"thickness_mm": 20, "form": "Roll"}'),

-- Expanded Polystyren
((SELECT id FROM m WHERE name = 'Expanded Polystyren'), 'Expanded Polystyren 20mm', '{"thickness_mm": 20}'),
((SELECT id FROM m WHERE name = 'Expanded Polystyren'), 'Expanded Polystyren 30mm', '{"thickness_mm": 30}'),
((SELECT id FROM m WHERE name = 'Expanded Polystyren'), 'Expanded Polystyren 50mm', '{"thickness_mm": 50}'),

-- Rubber
((SELECT id FROM m WHERE name = 'Rubber'), 'Rubber 10mm', '{"thickness_mm": 10, "form": "Roll"}'),
((SELECT id FROM m WHERE name = 'Rubber'), 'Rubber 20mm', '{"thickness_mm": 20, "form": "Roll"}'),

-- Carpet
((SELECT id FROM m WHERE name = 'Carpet'), 'Carpet 05mm', '{"thickness_mm": 5, "form": "Roll"}'),
((SELECT id FROM m WHERE name = 'Carpet'), 'Carpet 10mm', '{"thickness_mm": 10, "form": "Roll"}'),

-- Mesh
((SELECT id FROM m WHERE name = 'Mesh'), 'Mesh (Generic)', '{}'),

-- PlexiGlass
((SELECT id FROM m WHERE name = 'PlexiGlass'), 'PlexiGlass 05mm', '{"thickness_mm": 5}'),
((SELECT id FROM m WHERE name = 'PlexiGlass'), 'PlexiGlass 10mm', '{"thickness_mm": 10}'),

-- Silica Gel
((SELECT id FROM m WHERE name = 'Silica Gel'), 'Silica Gel 1Kg', '{"weight_kg": 1}'),
((SELECT id FROM m WHERE name = 'Silica Gel'), 'Silica Gel 2Kg', '{"weight_kg": 2}'),

-- Bolts
((SELECT id FROM m WHERE name = 'Bolts'), 'Bolts M10', '{"diameter_mm": 10}'),
((SELECT id FROM m WHERE name = 'Bolts'), 'Bolts M12', '{"diameter_mm": 12}'),

-- Nuts
((SELECT id FROM m WHERE name = 'Nuts'), 'Nuts M10', '{"diameter_mm": 10}'),
((SELECT id FROM m WHERE name = 'Nuts'), 'Nuts M12', '{"diameter_mm": 12}'),

-- Washers
((SELECT id FROM m WHERE name = 'Washers'), 'Washers M10', '{"diameter_mm": 10}'),
((SELECT id FROM m WHERE name = 'Washers'), 'Washers M12', '{"diameter_mm": 12}'),

-- Staples
((SELECT id FROM m WHERE name = 'Staples'), 'Staples (Generic)', '{}'),

-- Nails
((SELECT id FROM m WHERE name = 'Nails'), 'Nails (Generic)', '{}'),

-- Strapping
((SELECT id FROM m WHERE name = 'Strapping'), 'Strapping 19mm', '{"width_mm": 19, "form": "Roll"}'),
((SELECT id FROM m WHERE name = 'Strapping'), 'Strapping 25mm', '{"width_mm": 25, "form": "Roll"}'),

-- Bands
((SELECT id FROM m WHERE name = 'Bands'), 'Bands (Generic)', '{}'),

-- Adhesive Tape
((SELECT id FROM m WHERE name = 'Adhesive Tape'), 'Adhesive Tape 50mm', '{"width_mm": 50, "form": "Roll"}'),

-- Glue
((SELECT id FROM m WHERE name = 'Glue'), 'Glue 1Ltr', '{"volume_ltr": 1}'),
((SELECT id FROM m WHERE name = 'Glue'), 'Glue Can 5Ltr', '{"volume_ltr": 5, "form": "Can"}'),

-- Desiccant
((SELECT id FROM m WHERE name = 'Desiccant'), 'Desiccant 1Kg', '{"weight_kg": 1}'),
((SELECT id FROM m WHERE name = 'Desiccant'), 'Desiccant 2Kg', '{"weight_kg": 2}'),

-- VCI Film
((SELECT id FROM m WHERE name = 'VCI Film'), 'VCI Film 7ml - 200cm x 100m', '{"thickness_ml": 7, "width_cm": 200, "length_m": 100}'),
((SELECT id FROM m WHERE name = 'VCI Film'), 'VCI Film 10ml - 200cm x 100m', '{"thickness_ml": 10, "width_cm": 200, "length_m": 100}'),

-- Aluminum Foil
((SELECT id FROM m WHERE name = 'Aluminum Foil'), 'Aluminum Foil 7ml - 200cm x 100m', '{"thickness_ml": 7, "width_cm": 200, "length_m": 100}'),
((SELECT id FROM m WHERE name = 'Aluminum Foil'), 'Aluminum Foil 10ml - 200cm x 100m', '{"thickness_ml": 10, "width_cm": 200, "length_m": 100}'),

-- Bubble Wrap
((SELECT id FROM m WHERE name = 'Bubble Wrap'), 'Bubble Wrap 100cm', '{"width_cm": 100, "form": "Roll"}'),
((SELECT id FROM m WHERE name = 'Bubble Wrap'), 'Bubble Wrap 150cm', '{"width_cm": 150, "form": "Roll"}'),

-- Polyethylene Film
((SELECT id FROM m WHERE name = 'Polyethylene Film'), 'Polyethylene Film 150 Micron White', '{"micron": 150, "color": "White", "form": "Roll"}'),
((SELECT id FROM m WHERE name = 'Polyethylene Film'), 'Polyethylene Film 200 Micron Black', '{"micron": 200, "color": "Black", "form": "Roll"}'),

-- Stretch Film
((SELECT id FROM m WHERE name = 'Stretch Film'), 'Stretch Film 23 Micron - 50cm x 300m', '{"micron": 23, "width_cm": 50, "length_m": 300}'),

-- Foam Sheets
((SELECT id FROM m WHERE name = 'Foam Sheets'), 'Foam Sheets 05mm', '{"thickness_mm": 5, "form": "Sheet"}'),
((SELECT id FROM m WHERE name = 'Foam Sheets'), 'Foam Sheets 10mm', '{"thickness_mm": 10, "form": "Sheet"}'),
((SELECT id FROM m WHERE name = 'Foam Sheets'), 'Foam Sheets 20mm', '{"thickness_mm": 20, "form": "Sheet"}'),

-- High Density Foam
((SELECT id FROM m WHERE name = 'High Density Foam'), 'High Density Foam 05mm', '{"thickness_mm": 5, "density": "High", "form": "Sheet"}'),
((SELECT id FROM m WHERE name = 'High Density Foam'), 'High Density Foam 10mm', '{"thickness_mm": 10, "density": "High", "form": "Sheet"}'),
((SELECT id FROM m WHERE name = 'High Density Foam'), 'High Density Foam 20mm', '{"thickness_mm": 20, "density": "High", "form": "Sheet"}'),

-- BlueUFoam
((SELECT id FROM m WHERE name = 'BlueUFoam'), 'BlueUFoam 20mm', '{"thickness_mm": 20, "color": "Blue", "form": "Sheet"}'),
((SELECT id FROM m WHERE name = 'BlueUFoam'), 'BlueUFoam 30mm', '{"thickness_mm": 30, "color": "Blue", "form": "Sheet"}'),

-- Transportation (New material type)
((SELECT id FROM m WHERE name = 'Transportation'), 'Project Transportation Cost', '{"description": "Aggregated transportation cost for a project"}')
ON CONFLICT DO NOTHING;



-- --- 7. Populate public.tags ---
WITH inserted_tags AS (
    INSERT INTO public.tags (name) VALUES
    ('sides'),
    ('beam'),
    ('plank'),
    ('accessories'),
    ('adhesive'),
    ('lining'),
    ('fastener'),
    ('cushioning'),
    ('barrier'),
    ('transportation') -- New tag for transportation
    ON CONFLICT (name) DO NOTHING
    RETURNING id, name
)
SELECT * FROM inserted_tags;


-- --- 8. Populate public.material_tags ---
-- Link materials to their appropriate tags
WITH
    m AS (SELECT id, name FROM public.materials),
    t AS (SELECT id, name FROM public.tags)
INSERT INTO public.material_tags (material_id, tag_id) VALUES
-- Sides
((SELECT id FROM m WHERE name = 'Plywood'), (SELECT id FROM t WHERE name = 'sides')),
((SELECT id FROM m WHERE name = 'MDF'), (SELECT id FROM t WHERE name = 'sides')),
((SELECT id FROM m WHERE name = 'Triplex Carton'), (SELECT id FROM t WHERE name = 'sides')),
((SELECT id FROM m WHERE name = 'Polypropylene'), (SELECT id FROM t WHERE name = 'sides')),

-- Beam/Plank (Wood, LVL)
((SELECT id FROM m WHERE name = 'Wood'), (SELECT id FROM t WHERE name = 'beam')),
((SELECT id FROM m WHERE name = 'Wood'), (SELECT id FROM t WHERE name = 'plank')),
((SELECT id FROM m WHERE name = 'LVL'), (SELECT id FROM t WHERE name = 'beam')),
((SELECT id FROM m WHERE name = 'LVL'), (SELECT id FROM t WHERE name = 'plank')),

-- Fasteners
((SELECT id FROM m WHERE name = 'Screws'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Bolts'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Nuts'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Washers'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Staples'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Nails'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Strapping'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Bands'), (SELECT id FROM t WHERE name = 'fastener')),

-- Adhesives
((SELECT id FROM m WHERE name = 'Adhesive Tape'), (SELECT id FROM t WHERE name = 'adhesive')),
((SELECT id FROM m WHERE name = 'Glue'), (SELECT id FROM t WHERE name = 'adhesive')),

-- Lining/Barrier
((SELECT id FROM m WHERE name = 'Heat Shrink Film'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'Heat Shrink Film'), (SELECT id FROM t WHERE name = 'barrier')),
((SELECT id FROM m WHERE name = 'Tyvek'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'Tyvek'), (SELECT id FROM t WHERE name = 'barrier')),
((SELECT id FROM m WHERE name = 'VCI Film'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'VCI Film'), (SELECT id FROM t WHERE name = 'barrier')),
((SELECT id FROM m WHERE name = 'Aluminum Foil'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'Aluminum Foil'), (SELECT id FROM t WHERE name = 'barrier')),
((SELECT id FROM m WHERE name = 'Polyethylene Film'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'Polyethylene Film'), (SELECT id FROM t WHERE name = 'barrier')),
((SELECT id FROM m WHERE name = 'Stretch Film'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'Stretch Film'), (SELECT id FROM t WHERE name = 'barrier')),
((SELECT id FROM m WHERE name = 'Tarpaulin'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'Tarpaulin'), (SELECT id FROM t WHERE name = 'barrier')),

-- Cushioning
((SELECT id FROM m WHERE name = 'Flexible Foam'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'Expanded Polystyren'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'Rubber'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'Carpet'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'Bubble Wrap'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'Foam Sheets'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'High Density Foam'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'BlueUFoam'), (SELECT id FROM t WHERE name = 'cushioning')),

-- Accessories
((SELECT id FROM m WHERE name = 'Silica Gel'), (SELECT id FROM t WHERE name = 'accessories')),
((SELECT id FROM m WHERE name = 'Desiccant'), (SELECT id FROM t WHERE name = 'accessories')),
((SELECT id FROM m WHERE name = 'Mesh'), (SELECT id FROM t WHERE name = 'accessories')),
((SELECT id FROM m WHERE name = 'PlexiGlass'), (SELECT id FROM t WHERE name = 'accessories')),
((SELECT id FROM m WHERE name = 'Carton'), (SELECT id FROM t WHERE name = 'accessories')), -- Carton can be for various uses

-- Transportation
((SELECT id FROM m WHERE name = 'Transportation'), (SELECT id FROM t WHERE name = 'transportation'))
ON CONFLICT DO NOTHING;


-- --- 9. Populate public.supplier_pricing ---
-- Prices are illustrative. Adjust as needed.
WITH
    mv AS (SELECT id, variant_name FROM public.material_variants),
    s AS (SELECT id, name FROM public.suppliers),
    u AS (SELECT id, name FROM public.units_of_measure)
INSERT INTO public.supplier_pricing (material_variant_id, supplier_id, price, unit_id, stock_level) VALUES
-- Plywood from IPAC
((SELECT id FROM mv WHERE variant_name = 'Plywood - 09mm'), (SELECT id FROM s WHERE name = 'IPAC'), 15.00, (SELECT id FROM u WHERE name = 'm2'), 100),
((SELECT id FROM mv WHERE variant_name = 'Plywood - 12mm'), (SELECT id FROM s WHERE name = 'IPAC'), 18.50, (SELECT id FROM u WHERE name = 'm2'), 100),
((SELECT id FROM mv WHERE variant_name = 'Plywood - 18mm'), (SELECT id FROM s WHERE name = 'IPAC'), 25.00, (SELECT id FROM u WHERE name = 'm2'), 100),
((SELECT id FROM mv WHERE variant_name = 'Plywood - 09mm Marine'), (SELECT id FROM s WHERE name = 'IPAC'), 20.00, (SELECT id FROM u WHERE name = 'm2'), 50),
((SELECT id FROM mv WHERE variant_name = 'Plywood - 12mm Marine'), (SELECT id FROM s WHERE name = 'IPAC'), 24.50, (SELECT id FROM u WHERE name = 'm2'), 50),
((SELECT id FROM mv WHERE variant_name = 'Plywood - 18mm Marine'), (SELECT id FROM s WHERE name = 'IPAC'), 32.00, (SELECT id FROM u WHERE name = 'm2'), 50),

-- Tarpaulin from SAS
((SELECT id FROM mv WHERE variant_name = 'Tarpaulin - 200gsm'), (SELECT id FROM s WHERE name = 'SAS'), 2.10, (SELECT id FROM u WHERE name = 'm2'), 200),
((SELECT id FROM mv WHERE variant_name = 'Tarpaulin - 300gsm'), (SELECT id FROM s WHERE name = 'SAS'), 3.00, (SELECT id FROM u WHERE name = 'm2'), 200),
((SELECT id FROM mv WHERE variant_name = 'Tarpaulin - 400gsm'), (SELECT id FROM s WHERE name = 'SAS'), 3.90, (SELECT id FROM u WHERE name = 'm2'), 150),

-- MDF from IPAC
((SELECT id FROM mv WHERE variant_name = 'MDF - 06mm'), (SELECT id FROM s WHERE name = 'IPAC'), 10.00, (SELECT id FROM u WHERE name = 'm2'), 100),
((SELECT id FROM mv WHERE variant_name = 'MDF - 09mm'), (SELECT id FROM s WHERE name = 'IPAC'), 12.50, (SELECT id FROM u WHERE name = 'm2'), 100),
((SELECT id FROM mv WHERE variant_name = 'MDF - 12mm'), (SELECT id FROM s WHERE name = 'IPAC'), 15.00, (SELECT id FROM u WHERE name = 'm2'), 100),
((SELECT id FROM mv WHERE variant_name = 'MDF - 18mm'), (SELECT id FROM s WHERE name = 'IPAC'), 20.00, (SELECT id FROM u WHERE name = 'm2'), 100),

-- Wood from IPAC
((SELECT id FROM mv WHERE variant_name = 'Wood 2.5x5c (1''x2'')'), (SELECT id FROM s WHERE name = 'IPAC'), 1.20, (SELECT id FROM u WHERE name = 'Mtr'), 500),
((SELECT id FROM mv WHERE variant_name = 'Wood 5x7.5c (2''x3'')'), (SELECT id FROM s WHERE name = 'IPAC'), 2.50, (SELECT id FROM u WHERE name = 'Mtr'), 500),
((SELECT id FROM mv WHERE variant_name = 'Wood 10x10c (4''x4'')'), (SELECT id FROM s WHERE name = 'IPAC'), 5.00, (SELECT id FROM u WHERE name = 'Mtr'), 300),
((SELECT id FROM mv WHERE variant_name = 'Wood 10x14c (4''x6'')'), (SELECT id FROM s WHERE name = 'IPAC'), 7.00, (SELECT id FROM u WHERE name = 'Mtr'), 300),
((SELECT id FROM mv WHERE variant_name = 'Wood 14x14c (6''x6'')'), (SELECT id FROM s WHERE name = 'IPAC'), 9.50, (SELECT id FROM u WHERE name = 'Mtr'), 200),
((SELECT id FROM mv WHERE variant_name = 'Wood 14x16c (6''x8'')'), (SELECT id FROM s WHERE name = 'IPAC'), 11.00, (SELECT id FROM u WHERE name = 'Mtr'), 200),

-- Screws from ZOOM
((SELECT id FROM mv WHERE variant_name = 'Screws 5x80'), (SELECT id FROM s WHERE name = 'ZOOM'), 0.15, (SELECT id FROM u WHERE name = 'Pce'), 1000),
((SELECT id FROM mv WHERE variant_name = 'Screws 6x120'), (SELECT id FROM s WHERE name = 'ZOOM'), 0.25, (SELECT id FROM u WHERE name = 'Pce'), 1000),

-- Polypropylene from IPAC
((SELECT id FROM mv WHERE variant_name = 'Polypropylene 3mm'), (SELECT id FROM s WHERE name = 'IPAC'), 8.00, (SELECT id FROM u WHERE name = 'm2'), 100),
((SELECT id FROM mv WHERE variant_name = 'Polypropylene 5mm'), (SELECT id FROM s WHERE name = 'IPAC'), 12.00, (SELECT id FROM u WHERE name = 'm2'), 100),

-- Heat Shrink Film from SAS
((SELECT id FROM mv WHERE variant_name = 'Heat Shrink Film 7ml'), (SELECT id FROM s WHERE name = 'SAS'), 1.50, (SELECT id FROM u WHERE name = 'Mtr'), 50),
((SELECT id FROM mv WHERE variant_name = 'Heat Shrink Film 10ml'), (SELECT id FROM s WHERE name = 'SAS'), 2.00, (SELECT id FROM u WHERE name = 'Mtr'), 50),

-- Tyvek from SAINT-GOBAIN
((SELECT id FROM mv WHERE variant_name = 'Tyvek for Fine Art Only'), (SELECT id FROM s WHERE name = 'SAINT-GOBAIN'), 5.00, (SELECT id FROM u WHERE name = 'm2'), 30),

-- Carton from BAK
((SELECT id FROM mv WHERE variant_name = 'Carton Roll 100cm'), (SELECT id FROM s WHERE name = 'BAK'), 1.00, (SELECT id FROM u WHERE name = 'Mtr'), 100),

-- LVL from IPAC
((SELECT id FROM mv WHERE variant_name = 'LVL 38x90x6000'), (SELECT id FROM s WHERE name = 'IPAC'), 15.00, (SELECT id FROM u WHERE name = 'Pce'), 50),

-- Triplex Carton from BAK
((SELECT id FROM mv WHERE variant_name = 'Triplex Carton 15mm'), (SELECT id FROM s WHERE name = 'BAK'), 18.00, (SELECT id FROM u WHERE u.name = 'm2'), 50),

-- Flexible Foam from BAK
((SELECT id FROM mv WHERE variant_name = 'Flexible Foam 10mm'), (SELECT id FROM s WHERE name = 'BAK'), 0.80, (SELECT id FROM u WHERE name = 'm2'), 100),

-- Expanded Polystyren from BAK
((SELECT id FROM mv WHERE variant_name = 'Expanded Polystyren 20mm'), (SELECT id FROM s WHERE name = 'BAK'), 1.20, (SELECT id FROM u WHERE name = 'm2'), 80),

-- Rubber from BAK
((SELECT id FROM mv WHERE variant_name = 'Rubber 10mm'), (SELECT id FROM s WHERE name = 'BAK'), 2.50, (SELECT id FROM u WHERE name = 'm2'), 60),

-- Carpet from BAK
((SELECT id FROM mv WHERE variant_name = 'Carpet 05mm'), (SELECT id FROM s WHERE name = 'BAK'), 1.50, (SELECT id FROM u WHERE name = 'm2'), 70),

-- Silica Gel from ZOOM
((SELECT id FROM mv WHERE variant_name = 'Silica Gel 1Kg'), (SELECT id FROM s WHERE name = 'ZOOM'), 10.00, (SELECT id FROM u WHERE name = 'Kg'), 20),

-- VCI Film from SAS
((SELECT id FROM mv WHERE variant_name = 'VCI Film 7ml - 200cm x 100m'), (SELECT id FROM s WHERE name = 'SAS'), 30.00, (SELECT id FROM u WHERE name = 'Roll'), 10),

-- Aluminum Foil from ALU
((SELECT id FROM mv WHERE variant_name = 'Aluminum Foil 7ml - 200cm x 100m'), (SELECT id FROM s WHERE name = 'ALU'), 25.00, (SELECT id FROM u WHERE name = 'Roll'), 15),

-- Bubble Wrap from BAK
((SELECT id FROM mv WHERE variant_name = 'Bubble Wrap 100cm'), (SELECT id FROM s WHERE name = 'BAK'), 0.50, (SELECT id FROM u WHERE name = 'Mtr'), 200),

-- Polyethylene Film from SAS
((SELECT id FROM mv WHERE variant_name = 'Polyethylene Film 150 Micron White'), (SELECT id FROM s WHERE name = 'SAS'), 0.70, (SELECT id FROM u WHERE name = 'Mtr'), 150),

-- Stretch Film from SAS
((SELECT id FROM mv WHERE variant_name = 'Stretch Film 23 Micron - 50cm x 300m'), (SELECT id FROM s WHERE name = 'SAS'), 5.00, (SELECT id FROM u WHERE name = 'Roll'), 100),

-- Transportation Cost (New material type)
((SELECT id FROM mv WHERE variant_name = 'Project Transportation Cost'), (SELECT id FROM s WHERE name = 'Logistics Co A'), 500.00, (SELECT id FROM u WHERE name = 'trip'), NULL)
ON CONFLICT DO NOTHING;


-- --- 10. Populate public.tags ---
WITH inserted_tags AS (
    INSERT INTO public.tags (name) VALUES
    ('sides'),
    ('beam'),
    ('plank'),
    ('accessories'),
    ('adhesive'),
    ('lining'),
    ('fastener'),
    ('cushioning'),
    ('barrier'),
    ('transportation')
    ON CONFLICT (name) DO NOTHING
    RETURNING id, name
)
SELECT * FROM inserted_tags;


-- --- 11. Populate public.material_tags ---
-- Link materials to their appropriate tags
WITH
    m AS (SELECT id, name FROM public.materials),
    t AS (SELECT id, name FROM public.tags)
INSERT INTO public.material_tags (material_id, tag_id) VALUES
-- Sides
((SELECT id FROM m WHERE name = 'Plywood'), (SELECT id FROM t WHERE name = 'sides')),
((SELECT id FROM m WHERE name = 'MDF'), (SELECT id FROM t WHERE name = 'sides')),
((SELECT id FROM m WHERE name = 'Triplex Carton'), (SELECT id FROM t WHERE name = 'sides')),
((SELECT id FROM m WHERE name = 'Polypropylene'), (SELECT id FROM t WHERE name = 'sides')),

-- Beam/Plank (Wood, LVL)
((SELECT id FROM m WHERE name = 'Wood'), (SELECT id FROM t WHERE name = 'beam')),
((SELECT id FROM m WHERE name = 'Wood'), (SELECT id FROM t WHERE name = 'plank')),
((SELECT id FROM m WHERE name = 'LVL'), (SELECT id FROM t WHERE name = 'beam')),
((SELECT id FROM m WHERE name = 'LVL'), (SELECT id FROM t WHERE name = 'plank')),

-- Fasteners
((SELECT id FROM m WHERE name = 'Screws'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Bolts'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Nuts'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Washers'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Staples'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Nails'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Strapping'), (SELECT id FROM t WHERE name = 'fastener')),
((SELECT id FROM m WHERE name = 'Bands'), (SELECT id FROM t WHERE name = 'fastener')),

-- Adhesives
((SELECT id FROM m WHERE name = 'Adhesive Tape'), (SELECT id FROM t WHERE name = 'adhesive')),
((SELECT id FROM m WHERE name = 'Glue'), (SELECT id FROM t WHERE name = 'adhesive')),

-- Lining/Barrier
((SELECT id FROM m WHERE name = 'Heat Shrink Film'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'Heat Shrink Film'), (SELECT id FROM t WHERE name = 'barrier')),
((SELECT id FROM m WHERE name = 'Tyvek'), (SELECT id FROM t WHERE t.name = 'lining')),
((SELECT id FROM m WHERE name = 'Tyvek'), (SELECT id FROM t WHERE t.name = 'barrier')),
((SELECT id FROM m WHERE name = 'VCI Film'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'VCI Film'), (SELECT id FROM t WHERE name = 'barrier')),
((SELECT id FROM m WHERE name = 'Aluminum Foil'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'Aluminum Foil'), (SELECT id FROM t WHERE name = 'barrier')),
((SELECT id FROM m WHERE name = 'Polyethylene Film'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'Polyethylene Film'), (SELECT id FROM t WHERE name = 'barrier')),
((SELECT id FROM m WHERE name = 'Stretch Film'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'Stretch Film'), (SELECT id FROM t WHERE name = 'barrier')),
((SELECT id FROM m WHERE name = 'Tarpaulin'), (SELECT id FROM t WHERE name = 'lining')),
((SELECT id FROM m WHERE name = 'Tarpaulin'), (SELECT id FROM t WHERE name = 'barrier')),

-- Cushioning
((SELECT id FROM m WHERE name = 'Flexible Foam'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'Expanded Polystyren'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'Rubber'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'Carpet'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'Bubble Wrap'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'Foam Sheets'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'High Density Foam'), (SELECT id FROM t WHERE name = 'cushioning')),
((SELECT id FROM m WHERE name = 'BlueUFoam'), (SELECT id FROM t WHERE name = 'cushioning')),

-- Accessories
((SELECT id FROM m WHERE name = 'Silica Gel'), (SELECT id FROM t WHERE name = 'accessories')),
((SELECT id FROM m WHERE name = 'Desiccant'), (SELECT id FROM t WHERE name = 'accessories')),
((SELECT id FROM m WHERE name = 'Mesh'), (SELECT id FROM t WHERE name = 'accessories')),
((SELECT id FROM m WHERE name = 'PlexiGlass'), (SELECT id FROM t WHERE name = 'accessories')),
((SELECT id FROM m WHERE name = 'Carton'), (SELECT id FROM t WHERE name = 'accessories')),

-- Transportation (Material tagged as transportation)
((SELECT id FROM m WHERE name = 'Transportation'), (SELECT id FROM t WHERE name = 'transportation'))
ON CONFLICT DO NOTHING;

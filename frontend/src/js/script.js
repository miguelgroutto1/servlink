// Sistema de autenticação apenas com frontend (localStorage)
// Variáveis globais
let authToken = localStorage.getItem('servlink_token');
let currentUser = JSON.parse(localStorage.getItem('servlink_user') || 'null');
let notificationInterval = null; // Interval para atualizações em tempo real

const CATEGORY_MAP = {
    reparos: { id: 1, name: 'Reparos', icon: 'fas fa-tools', emoji: '🔧' },
    limpeza: { id: 2, name: 'Limpeza', icon: 'fas fa-home', emoji: '🧹' },
    pintura: { id: 3, name: 'Pintura', icon: 'fas fa-paint-roller', emoji: '🎨' },
    eletrica: { id: 4, name: 'Elétrica', icon: 'fas fa-plug', emoji: '⚡' },
    encanamento: { id: 5, name: 'Encanamento', icon: 'fas fa-faucet', emoji: '🔩' },
    jardinagem: { id: 6, name: 'Jardinagem', icon: 'fas fa-leaf', emoji: '🌱' },
    outros: { id: 7, name: 'Outros', icon: 'fas fa-briefcase', emoji: '📦' }
};

const CATEGORY_ID_MAP = Object.entries(CATEGORY_MAP).reduce((map, [slug, data]) => {
    map[data.id] = { slug, name: data.name };
    return map;
}, {});

const DEFAULT_SERVICE_IMAGE = 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60';
// Foto padrão estilo Instagram (silhueta de pessoa em SVG)
const DEFAULT_PROFILE_IMAGE = 'data:image/svg+xml;utf8,<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="%23E0E0E0"/><circle cx="50" cy="35" r="15" fill="%23999999"/><path d="M20 75C15 75 10 80 10 85V95C10 97 12 100 15 100H85C87 95 90 95 90 95V85C90 80 85 75 80 75H20Z" fill="%23999999"/></svg>';
let cachedCategories = null;

// Função helper para obter o caminho base das páginas
function getPagesPath() {
    const currentPath = window.location.pathname;
    const currentHref = window.location.href;
    
    // Se já estamos em pages/, retorna vazio (caminho relativo)
    // Isso funciona quando o servidor está servindo a partir de src/
    if (currentPath.includes('/pages/') || currentPath.includes('\\pages\\') || 
        currentHref.includes('/pages/') || currentHref.includes('\\pages\\')) {
        return '';
    }
    
    // Se não estamos em pages/, sempre usar o caminho completo src/pages/
    // Isso garante que funciona independente de onde o servidor está servindo
    return 'src/pages/';
}

function isTestEnvironment() {
    const currentPath = window.location.pathname.toLowerCase();
    const currentHref = window.location.href.toLowerCase();
    return currentPath.endsWith('test.html') || currentHref.includes('test.html');
}

function navigateToPage(relativePath) {
    const pagesPath = getPagesPath();
    const targetUrl = relativePath.startsWith('http') || relativePath.startsWith('/')
        ? relativePath
        : pagesPath + relativePath;
    
    if (isTestEnvironment()) {
        window.open(targetUrl, '_blank');
    } else {
        window.location.href = targetUrl;
    }
}

function normalizeImagesInput(images) {
    if (!images) return [];
    if (Array.isArray(images)) {
        return images.filter(Boolean);
    }
    if (typeof images === 'string') {
        const trimmed = images.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.filter(Boolean);
            }
        } catch (error) {
            // Ignorar erro e tentar dividir por vírgulas
        }
        return trimmed.split(',').map(img => img.trim()).filter(Boolean);
    }
    return [];
}

function normalizeTagsInput(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) {
        return tags.filter(Boolean);
    }
    if (typeof tags === 'string') {
        return tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }
    return [];
}

function getPrimaryServiceImage(service) {
    if (!service) return DEFAULT_SERVICE_IMAGE;
    const normalizedImages = normalizeImagesInput(service.images);
    if (normalizedImages.length) {
        return normalizedImages[0];
    }
    if (service.image_url) {
        return service.image_url;
    }
    return DEFAULT_SERVICE_IMAGE;
}

function formatPriceValue(value) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
        return '0.00';
    }
    return numeric.toFixed(2);
}

function getPriceTypeLabel(priceType) {
    const map = {
        hour: 'hora',
        day: 'dia',
        service: 'serviço',
        visit: 'visita'
    };
    return map[priceType] || priceType || 'serviço';
}

function resolveCategoryData(serviceData = {}) {
    let slug = serviceData.category;

    if (!slug && serviceData.category_name) {
        const normalizedName = serviceData.category_name.trim().toLowerCase();
        slug = Object.keys(CATEGORY_MAP).find(key => CATEGORY_MAP[key].name.toLowerCase() === normalizedName);
    }

    if (!slug && serviceData.category_id) {
        const info = CATEGORY_ID_MAP[Number(serviceData.category_id)];
        if (info) {
            slug = info.slug;
        }
    }

    if (!slug && serviceData.category && CATEGORY_MAP[serviceData.category]) {
        slug = serviceData.category;
    }

    if (!slug) {
        slug = 'outros';
    }

    const categoryInfo = CATEGORY_MAP[slug] || CATEGORY_MAP.outros;
    const categoryId = Number(serviceData.category_id) || categoryInfo.id;
    const categoryName = serviceData.category_name || categoryInfo.name;

    return {
        category: slug,
        category_id: categoryId,
        category_name: categoryName
    };
}

async function populateCategorySelect(selectRef, options = {}) {
    const selectEl = typeof selectRef === 'string' ? document.getElementById(selectRef) : selectRef;
    if (!selectEl) return;

    const {
        keepExistingOptions = false,
        includePlaceholder = false,
        placeholderLabel = 'Selecione uma categoria',
        placeholderValue = '',
        placeholderDisabled = false,
        optionFormatter = null
    } = options;

    if (!keepExistingOptions) {
        selectEl.innerHTML = '';
    }

    if (includePlaceholder) {
        const placeholder = document.createElement('option');
        placeholder.value = placeholderValue;
        placeholder.textContent = placeholderLabel;
        if (placeholderDisabled) {
            placeholder.disabled = true;
            placeholder.selected = true;
        }
        selectEl.appendChild(placeholder);
    }

    const categories = await getCategories();
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.dataset.slug = category.slug;
        option.textContent = optionFormatter ? optionFormatter(category) : category.name;
        selectEl.appendChild(option);
    });
}

// Inicializar dados mock se não existirem
function initializeMockData() {
    // Mapeamento de cidades atualizadas para os profissionais
    const cityUpdates = {
        2: 'Bauru',
        3: 'Marília',
        4: 'Santa Cruz do Rio Pardo',
        5: 'Mogi Mirim',
        6: 'Mogi Guaçu',
        7: 'Campinas',
        8: 'Agudos',
        9: 'Bauru',
        10: 'Marília',
        11: 'Santa Cruz do Rio Pardo',
        12: 'Mogi Mirim'
    };
    
    if (!localStorage.getItem('servlink_users')) {
        const mockUsers = [
            {
                id: 1,
                name: 'Maria Silva',
                email: 'maria@example.com',
                password: '123456', // Em produção, seria hash
                phone: '(11) 99999-9999',
                address: 'Rua das Flores, 123',
                city: 'São Paulo',
                state: 'SP',
                user_type: 'cliente',
                profile_image: 'https://randomuser.me/api/portraits/women/32.jpg',
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                name: 'João Santos',
                email: 'joao@example.com',
                password: '123456',
                phone: '(11) 88888-8888',
                address: 'Av. Paulista, 456',
                city: 'Bauru',
                state: 'SP',
                user_type: 'profissional',
                profile_image: 'https://randomuser.me/api/portraits/men/22.jpg',
                created_at: new Date().toISOString()
            },
            // 3 Pedreiros
            {
                id: 3,
                name: 'Carlos Mendes',
                email: 'carlos@example.com',
                password: '123456',
                phone: '(11) 77777-7777',
                address: 'Rua dos Pedreiros, 100',
                city: 'Marília',
                state: 'SP',
                user_type: 'profissional',
                profile_image: 'https://randomuser.me/api/portraits/men/45.jpg',
                created_at: new Date().toISOString()
            },
            {
                id: 4,
                name: 'Roberto Alves',
                email: 'roberto@example.com',
                password: '123456',
                phone: '(11) 66666-6666',
                address: 'Av. Construção, 200',
                city: 'Santa Cruz do Rio Pardo',
                state: 'SP',
                user_type: 'profissional',
                profile_image: 'https://randomuser.me/api/portraits/men/67.jpg',
                created_at: new Date().toISOString()
            },
            {
                id: 5,
                name: 'Fernando Costa',
                email: 'fernando@example.com',
                password: '123456',
                phone: '(11) 55555-5555',
                address: 'Rua das Obras, 300',
                city: 'Mogi Mirim',
                state: 'SP',
                user_type: 'profissional',
                profile_image: 'https://randomuser.me/api/portraits/men/78.jpg',
                created_at: new Date().toISOString()
            },
            // 4 Encanadores
            {
                id: 6,
                name: 'Paulo Lima',
                email: 'paulo@example.com',
                password: '123456',
                phone: '(11) 44444-4444',
                address: 'Rua das Águas, 150',
                city: 'Mogi Guaçu',
                state: 'SP',
                user_type: 'profissional',
                profile_image: 'https://randomuser.me/api/portraits/men/34.jpg',
                created_at: new Date().toISOString()
            },
            {
                id: 7,
                name: 'Marcos Oliveira',
                email: 'marcos@example.com',
                password: '123456',
                phone: '(11) 33333-3333',
                address: 'Av. Hidráulica, 250',
                city: 'Campinas',
                state: 'SP',
                user_type: 'profissional',
                profile_image: 'https://randomuser.me/api/portraits/men/56.jpg',
                created_at: new Date().toISOString()
            },
            {
                id: 8,
                name: 'Ricardo Souza',
                email: 'ricardo@example.com',
                password: '123456',
                phone: '(11) 22222-2222',
                address: 'Rua dos Canos, 350',
                city: 'Agudos',
                state: 'SP',
                user_type: 'profissional',
                profile_image: 'https://randomuser.me/api/portraits/men/89.jpg',
                created_at: new Date().toISOString()
            },
            {
                id: 9,
                name: 'André Ferreira',
                email: 'andre@example.com',
                password: '123456',
                phone: '(11) 11111-1111',
                address: 'Av. Encanamento, 450',
                city: 'Bauru',
                state: 'SP',
                user_type: 'profissional',
                profile_image: 'https://randomuser.me/api/portraits/men/12.jpg',
                created_at: new Date().toISOString()
            },
            // 2 Eletricistas
            {
                id: 10,
                name: 'Lucas Martins',
                email: 'lucas@example.com',
                password: '123456',
                phone: '(11) 10101-0101',
                address: 'Rua Elétrica, 500',
                city: 'Marília',
                state: 'SP',
                user_type: 'profissional',
                profile_image: 'https://randomuser.me/api/portraits/men/23.jpg',
                created_at: new Date().toISOString()
            },
            {
                id: 11,
                name: 'Felipe Rocha',
                email: 'felipe@example.com',
                password: '123456',
                phone: '(11) 20202-0202',
                address: 'Av. Energia, 600',
                city: 'Santa Cruz do Rio Pardo',
                state: 'SP',
                user_type: 'profissional',
                profile_image: 'https://randomuser.me/api/portraits/men/91.jpg',
                created_at: new Date().toISOString()
            },
            // 1 Jardineiro
            {
                id: 12,
                name: 'Gabriel Silva',
                email: 'gabriel@example.com',
                password: '123456',
                phone: '(11) 30303-0303',
                address: 'Rua das Plantas, 700',
                city: 'Mogi Mirim',
                state: 'SP',
                user_type: 'profissional',
                profile_image: 'https://randomuser.me/api/portraits/men/14.jpg',
                created_at: new Date().toISOString()
            }
        ];
        localStorage.setItem('servlink_users', JSON.stringify(mockUsers));
    } else {
        // Atualizar cidades dos profissionais existentes
        const existingUsers = JSON.parse(localStorage.getItem('servlink_users') || '[]');
        let updated = false;
        
        existingUsers.forEach(user => {
            if (cityUpdates[user.id] && user.city !== cityUpdates[user.id]) {
                user.city = cityUpdates[user.id];
                updated = true;
            }
        });
        
        if (updated) {
            localStorage.setItem('servlink_users', JSON.stringify(existingUsers));
            
            // Atualizar localização dos serviços correspondentes
            const existingServices = JSON.parse(localStorage.getItem('servlink_services') || '[]');
            existingServices.forEach(service => {
                const provider = existingUsers.find(u => u.id === service.provider_id);
                if (provider && cityUpdates[provider.id]) {
                    service.location = `${provider.city}, ${provider.state || 'SP'}`;
                }
            });
            localStorage.setItem('servlink_services', JSON.stringify(existingServices));
        }
    }
    
    // Inicializar serviços para os profissionais
    initializeMockServices();
}

// Inicializar serviços mock para os profissionais
function initializeMockServices() {
    if (!localStorage.getItem('servlink_services')) {
        const users = JSON.parse(localStorage.getItem('servlink_users') || '[]');
        const services = [];
        
        // Encontrar os usuários profissionais
        const profissionais = users.filter(u => u.user_type === 'profissional');
        
        // Base timestamp para garantir IDs únicos
        const baseTimestamp = Date.now();
        
        profissionais.forEach((prof, index) => {
            let serviceData = {};
            
            // Gerar ID único baseado no timestamp + índice + ID do usuário
            const serviceId = baseTimestamp + (prof.id * 1000) + index;
            
            // Definir serviço baseado no ID do usuário (mais confiável)
            // IDs 3, 4, 5 = Pedreiros (Carlos, Roberto, Fernando)
            if (prof.id === 3) {
                // Carlos - Pedreiro
                serviceData = {
                    id: serviceId,
                    provider_id: prof.id,
                    provider_name: prof.name,
                    title: 'Alvenaria e Construção de Muros',
                    description: 'Especializado em construção de muros, alvenaria estrutural e acabamentos. Trabalho com materiais de qualidade e entrega no prazo.',
                    price: 150.00,
                    price_type: 'day',
                    location: `${prof.city || 'São Paulo'}, ${prof.state || 'SP'}`,
                    availability: 'flexible',
                    experience_years: Math.floor(Math.random() * 15) + 5,
                    images: ['https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
                    tags: ['pedreiro', 'construção', 'muros', 'alvenaria', 'acabamento'],
                    category: 'reparos',
                    category_id: 1,
                    category_name: 'Reparos',
                    created_at: new Date().toISOString(),
                    avg_rating: 0,
                    review_count: 0,
                    status: 'active'
                };
            } else if (prof.id === 4) {
                // Roberto - Pedreiro
                serviceData = {
                    id: serviceId,
                    provider_id: prof.id,
                    provider_name: prof.name,
                    title: 'Reformas e Acabamentos em Geral',
                    description: 'Realizo reformas completas, reboco, pintura e todos os tipos de acabamento. Transformo seu espaço com qualidade e dedicação.',
                    price: 140.00,
                    price_type: 'day',
                    location: `${prof.city || 'São Paulo'}, ${prof.state || 'SP'}`,
                    availability: 'flexible',
                    experience_years: Math.floor(Math.random() * 15) + 5,
                    images: ['https://images.unsplash.com/photo-1581578731548-c64695cc6952?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
                    tags: ['pedreiro', 'reforma', 'reboco', 'acabamento', 'pintura'],
                    category: 'reparos',
                    category_id: 1,
                    category_name: 'Reparos',
                    created_at: new Date().toISOString(),
                    avg_rating: 0,
                    review_count: 0,
                    status: 'active'
                };
            } else if (prof.id === 5) {
                // Fernando - Pedreiro
                serviceData = {
                    id: serviceId,
                    provider_id: prof.id,
                    provider_name: prof.name,
                    title: 'Construção e Reparos Residenciais',
                    description: 'Serviços de construção, reparos estruturais e manutenção predial. Atendo residências e pequenos comércios com excelência.',
                    price: 160.00,
                    price_type: 'day',
                    location: `${prof.city || 'São Paulo'}, ${prof.state || 'SP'}`,
                    availability: 'flexible',
                    experience_years: Math.floor(Math.random() * 15) + 5,
                    images: ['https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
                    tags: ['pedreiro', 'construção', 'reparos', 'estrutural', 'manutenção'],
                    category: 'reparos',
                    category_id: 1,
                    category_name: 'Reparos',
                    created_at: new Date().toISOString(),
                    avg_rating: 0,
                    review_count: 0,
                    status: 'active'
                };
            } else if (prof.id === 6) {
                // Paulo - Encanador
                serviceData = {
                    id: serviceId,
                    provider_id: prof.id,
                    provider_name: prof.name,
                    title: 'Desentupimento e Limpeza de Esgoto',
                    description: 'Especializado em desentupimento de ralos, pias, vasos sanitários e esgotos. Atendimento rápido e eficiente com garantia.',
                    price: 120.00,
                    price_type: 'service',
                    location: `${prof.city || 'São Paulo'}, ${prof.state || 'SP'}`,
                    availability: 'flexible',
                    experience_years: Math.floor(Math.random() * 12) + 5,
                    images: ['https://images.unsplash.com/photo-1621905251918-48416bd8575a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
                    tags: ['encanamento', 'desentupimento', 'limpeza', 'esgoto', 'rápido'],
                    category: 'encanamento',
                    category_id: 5,
                    category_name: 'Encanamento',
                    created_at: new Date().toISOString(),
                    avg_rating: 0,
                    review_count: 0,
                    status: 'active'
                };
            } else if (prof.id === 7) {
                // Marcos - Encanador
                serviceData = {
                    id: serviceId,
                    provider_id: prof.id,
                    provider_name: prof.name,
                    title: 'Instalação Hidráulica Completa',
                    description: 'Instalação de torneiras, chuveiros, descargas e toda a parte hidráulica. Trabalho com materiais de primeira linha.',
                    price: 130.00,
                    price_type: 'service',
                    location: `${prof.city || 'São Paulo'}, ${prof.state || 'SP'}`,
                    availability: 'flexible',
                    experience_years: Math.floor(Math.random() * 12) + 5,
                    images: ['https://images.unsplash.com/photo-1621905252507-b35492cc74b4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
                    tags: ['encanamento', 'instalação', 'hidráulica', 'torneiras', 'chuveiros'],
                    category: 'encanamento',
                    category_id: 5,
                    category_name: 'Encanamento',
                    created_at: new Date().toISOString(),
                    avg_rating: 0,
                    review_count: 0,
                    status: 'active'
                };
            } else if (prof.id === 8) {
                // Ricardo - Encanador
                serviceData = {
                    id: serviceId,
                    provider_id: prof.id,
                    provider_name: prof.name,
                    title: 'Reparos e Manutenção Hidráulica',
                    description: 'Reparos em vazamentos, troca de canos, manutenção preventiva e corretiva. Solução rápida para seus problemas hidráulicos.',
                    price: 115.00,
                    price_type: 'service',
                    location: `${prof.city || 'São Paulo'}, ${prof.state || 'SP'}`,
                    availability: 'flexible',
                    experience_years: Math.floor(Math.random() * 12) + 5,
                    images: ['https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
                    tags: ['encanamento', 'reparos', 'vazamentos', 'manutenção', 'canos'],
                    category: 'encanamento',
                    category_id: 5,
                    category_name: 'Encanamento',
                    created_at: new Date().toISOString(),
                    avg_rating: 0,
                    review_count: 0,
                    status: 'active'
                };
            } else if (prof.id === 9) {
                // André - Encanador
                serviceData = {
                    id: serviceId,
                    provider_id: prof.id,
                    provider_name: prof.name,
                    title: 'Serviços de Encanamento Residencial',
                    description: 'Atendo todas as necessidades de encanamento residencial. Desde instalações simples até reformas completas do sistema hidráulico.',
                    price: 125.00,
                    price_type: 'service',
                    location: `${prof.city || 'São Paulo'}, ${prof.state || 'SP'}`,
                    availability: 'flexible',
                    experience_years: Math.floor(Math.random() * 12) + 5,
                    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
                    tags: ['encanamento', 'residencial', 'reformas', 'sistema', 'hidráulico'],
                    category: 'encanamento',
                    category_id: 5,
                    category_name: 'Encanamento',
                    created_at: new Date().toISOString(),
                    avg_rating: 0,
                    review_count: 0,
                    status: 'active'
                };
            } else if (prof.id === 10) {
                // Lucas - Eletricista
                serviceData = {
                    id: serviceId,
                    provider_id: prof.id,
                    provider_name: prof.name,
                    title: 'Instalação Elétrica Residencial',
                    description: 'Instalação completa de sistemas elétricos, tomadas, interruptores e iluminação. Trabalho seguindo todas as normas de segurança.',
                    price: 100.00,
                    price_type: 'service',
                    location: `${prof.city || 'São Paulo'}, ${prof.state || 'SP'}`,
                    availability: 'flexible',
                    experience_years: Math.floor(Math.random() * 10) + 5,
                    images: ['https://images.unsplash.com/photo-1621905251189-08b45d6a269e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
                    tags: ['elétrica', 'instalação', 'residencial', 'tomadas', 'iluminação'],
                    category: 'eletrica',
                    category_id: 4,
                    category_name: 'Elétrica',
                    created_at: new Date().toISOString(),
                    avg_rating: 0,
                    review_count: 0,
                    status: 'active'
                };
            } else if (prof.id === 11) {
                // Felipe - Eletricista
                serviceData = {
                    id: serviceId,
                    provider_id: prof.id,
                    provider_name: prof.name,
                    title: 'Reparos e Manutenção Elétrica',
                    description: 'Reparos em quadros elétricos, troca de disjuntores, correção de problemas elétricos e manutenção preventiva. Atendimento urgente disponível.',
                    price: 110.00,
                    price_type: 'service',
                    location: `${prof.city || 'São Paulo'}, ${prof.state || 'SP'}`,
                    availability: 'flexible',
                    experience_years: Math.floor(Math.random() * 10) + 5,
                    images: ['https://images.unsplash.com/photo-1621905252507-b35492cc74b4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
                    tags: ['elétrica', 'reparos', 'manutenção', 'quadros', 'disjuntores'],
                    category: 'eletrica',
                    category_id: 4,
                    category_name: 'Elétrica',
                    created_at: new Date().toISOString(),
                    avg_rating: 0,
                    review_count: 0,
                    status: 'active'
                };
            } else if (prof.id === 12) {
                // Gabriel - Jardineiro
                serviceData = {
                    id: serviceId,
                    provider_id: prof.id,
                    provider_name: prof.name,
                    title: 'Jardinagem e Paisagismo Residencial',
                    description: 'Cuidados completos com jardins, poda de árvores, plantio de flores e gramados. Transformo seu espaço externo em um ambiente acolhedor.',
                    price: 80.00,
                    price_type: 'hour',
                    location: `${prof.city || 'São Paulo'}, ${prof.state || 'SP'}`,
                    availability: 'flexible',
                    experience_years: Math.floor(Math.random() * 8) + 3,
                    images: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
                    tags: ['jardinagem', 'paisagismo', 'poda', 'plantio', 'gramados'],
                    category: 'jardinagem',
                    category_id: 6,
                    category_name: 'Jardinagem',
                    created_at: new Date().toISOString(),
                    avg_rating: 0,
                    review_count: 0,
                    status: 'active'
                };
            } else {
                // Para João Santos (ID 2) ou outros profissionais sem categoria específica
                serviceData = {
                    id: serviceId,
                    provider_id: prof.id,
                    provider_name: prof.name,
                    title: 'Serviços Gerais e Manutenção',
                    description: 'Ofereço serviços diversos com qualidade e comprometimento. Pequenos reparos, montagens e manutenções em geral.',
                    price: 90.00,
                    price_type: 'service',
                    location: `${prof.city || 'São Paulo'}, ${prof.state || 'SP'}`,
                    availability: 'flexible',
                    experience_years: 5,
                    images: ['https://images.unsplash.com/photo-1581092160562-40aa08e78837?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
                    tags: ['serviços', 'geral', 'reparos', 'manutenção', 'montagem'],
                    category: 'outros',
                    category_id: 7,
                    category_name: 'Outros',
                    created_at: new Date().toISOString(),
                    avg_rating: 0,
                    review_count: 0,
                    status: 'active'
                };
            }
            
            if (serviceData.id) {
                services.push(serviceData);
            }
        });
        
        localStorage.setItem('servlink_services', JSON.stringify(services));
    }
}

// Função para simular requisições à API (apenas frontend)
async function apiRequest(endpoint, options = {}) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    
    try {
        switch (endpoint) {
            case '/auth/login':
                return await handleLogin(body);
            case '/auth/register':
                return await handleRegister(body);
            case '/user/profile':
                return currentUser;
            default:
                throw new Error('Endpoint não implementado');
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

// Funções de autenticação (apenas frontend)
async function handleLogin(credentials) {
    const users = JSON.parse(localStorage.getItem('servlink_users') || '[]');
    const user = users.find(u => u.email === credentials.email && u.password === credentials.password);
    
    if (!user) {
        throw new Error('Email ou senha incorretos');
    }
    
    // Gerar token simples (em produção seria JWT)
    const token = 'mock_token_' + Date.now();
    
    return {
        token: token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            user_type: user.user_type,
            phone: user.phone,
            address: user.address,
            city: user.city,
            state: user.state,
            profile_image: user.profile_image || DEFAULT_PROFILE_IMAGE
        }
    };
}

async function handleRegister(userData) {
    const users = JSON.parse(localStorage.getItem('servlink_users') || '[]');
    
    // Verificar se email já existe
    if (users.find(u => u.email === userData.email)) {
        throw new Error('Email já cadastrado');
    }
    
    // Criar novo usuário
    const newUser = {
        id: Date.now(), // ID simples
        name: userData.name,
        email: userData.email,
        password: userData.password, // Em produção seria hash
        phone: userData.phone || '',
        address: userData.address || '',
        city: userData.city || '',
        state: userData.state || '',
        user_type: userData.user_type,
        profile_image: DEFAULT_PROFILE_IMAGE, // Foto padrão estilo Instagram
        created_at: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem('servlink_users', JSON.stringify(users));
    
    // Gerar token simples
    const token = 'mock_token_' + Date.now();
    
    return {
        token: token,
        user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            user_type: newUser.user_type,
            phone: newUser.phone,
            address: newUser.address,
            city: newUser.city,
            state: newUser.state,
            profile_image: newUser.profile_image
        }
    };
}

async function login(email, password) {
    try {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        authToken = response.token;
        currentUser = response.user;
        
        localStorage.setItem('servlink_token', authToken);
        localStorage.setItem('servlink_user', JSON.stringify(currentUser));
        
        showSuccessMessage('Login realizado com sucesso!');
        updateAuthUI();
        
        // Redirecionar para dashboard baseado no tipo de usuário
        if (currentUser && currentUser.user_type === 'profissional') {
            navigateToPage('dashboard-prestador.html');
        } else {
            navigateToPage('dashboard.html');
        }
        
        return response;
    } catch (error) {
        showErrorMessage(error.message || 'Erro ao fazer login');
        throw error;
    }
}

async function register(userData) {
    try {
        const response = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        // Não fazer login automático - apenas salvar os dados
        // authToken = response.token;
        // currentUser = response.user;
        
        // localStorage.setItem('servlink_token', authToken);
        // localStorage.setItem('servlink_user', JSON.stringify(currentUser));
        
        showSuccessMessage('Cadastro realizado com sucesso! Faça login para continuar.');
        // updateAuthUI();
        navigateToPage('auth.html');
        
        return response;
    } catch (error) {
        showErrorMessage(error.message || 'Erro ao fazer cadastro');
        throw error;
    }
}

async function fetchUserProfile() {
    try {
        const user = await apiRequest('/user/profile');
        currentUser = user;
        localStorage.setItem('servlink_user', JSON.stringify(user));
        return user;
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        return currentUser;
    }
}

// Mobile Menu Toggle com animação
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');
if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('show');
    });
    // Fecha o menu ao clicar em um link
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('show');
        });
    });
}
// Fecha o menu ao clicar fora
window.addEventListener('click', function(e) {
    if (mobileMenu && mobileMenuButton && !mobileMenu.contains(e.target) && !mobileMenuButton.contains(e.target)) {
        mobileMenu.classList.remove('show');
    }
});

// Fecha o menu ao clicar em um link
if (mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('show');
        });
    });
}
// FAQ Accordion
const faqQuestions = document.querySelectorAll('.faq-question');
faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
        const answer = question.parentElement.querySelector('.faq-answer');
        const icon = question.querySelector('i');
        // Close all other answers
        document.querySelectorAll('.faq-answer').forEach(item => {
            if (item !== answer) {
                item.classList.remove('active');
                if(item.previousElementSibling && item.previousElementSibling.querySelector('i')){
                    item.previousElementSibling.querySelector('i').classList.remove('fa-chevron-up');
                    item.previousElementSibling.querySelector('i').classList.add('fa-chevron-down');
                }
            }
        });
        // Toggle current answer
        answer.classList.toggle('active');
        icon.classList.toggle('fa-chevron-up');
        icon.classList.toggle('fa-chevron-down');
    });
});
// Back to Top Button
const backToTopButton = document.getElementById('back-to-top');
if (backToTopButton) {
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopButton.classList.add('show');
        } else {
            backToTopButton.classList.remove('show');
        }
    });
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}
// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
            // Close mobile menu if open
            if (mobileMenu && mobileMenu.classList.contains('show')) {
                mobileMenu.classList.remove('show');
            }
        }
    });
});
// Auth Form Functionality
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const toSignup = document.getElementById('to-signup');
const toLogin = document.getElementById('to-login');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

if (loginTab && signupTab && loginForm && signupForm) {
    loginTab.addEventListener('click', showLogin);
    signupTab.addEventListener('click', showSignup);
    
    if (toSignup) {
        toSignup.addEventListener('click', (e) => {
            e.preventDefault();
            showSignup();
        });
    }
    
    if (toLogin) {
        toLogin.addEventListener('click', (e) => {
            e.preventDefault();
            showLogin();
        });
    }
    
    // Initialize with login form visible
    showLogin();
}

function showLogin() {
    if (loginForm && signupForm && loginTab && signupTab) {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        loginTab.classList.add('tab-active');
        signupTab.classList.remove('tab-active');
        
        // Trigger animation
        loginForm.classList.remove('fade-in');
        void loginForm.offsetWidth;
        loginForm.classList.add('fade-in');
    }
}

function showSignup() {
    if (loginForm && signupForm && loginTab && signupTab) {
        signupForm.style.display = 'block';
        loginForm.style.display = 'none';
        signupTab.classList.add('tab-active');
        loginTab.classList.remove('tab-active');
        
        // Trigger animation
        signupForm.classList.remove('fade-in');
        void signupForm.offsetWidth;
        signupForm.classList.add('fade-in');
    }
}

// Password visibility toggle
const togglePassword = document.getElementById('toggle-password');
const toggleSignupPassword = document.getElementById('toggle-signup-password');

if (togglePassword) {
    togglePassword.addEventListener('click', function() {
        const passwordInput = document.getElementById('login-password');
        const eyeIcon = this.querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });
}

if (toggleSignupPassword) {
    toggleSignupPassword.addEventListener('click', function() {
        const passwordInput = document.getElementById('signup-password');
        const eyeIcon = this.querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });
}

// Dark mode toggle
function setDarkMode(dark) {
    const body = document.body;
    const btn = document.getElementById('dark-mode-toggle');
    const btnMobile = document.getElementById('dark-mode-toggle-mobile');
    if (dark) {
        body.classList.add('dark');
        // Sincronizar também com data-theme para componentes que usam [data-theme="dark"]
        document.documentElement.setAttribute('data-theme', 'dark');
        if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
        if (btnMobile) btnMobile.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        body.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        if (btn) btn.innerHTML = '<i class="fas fa-moon"></i>';
        if (btnMobile) btnMobile.innerHTML = '<i class="fas fa-moon"></i>';
    }
}
function toggleDarkMode() {
    const isDark = document.body.classList.contains('dark');
    setDarkMode(!isDark);
    localStorage.setItem('servlink-dark', !isDark ? '1' : '0');
}
// Função para atualizar interface baseada no status de autenticação
function updateAuthUI() {
    const isAuthenticated = !!authToken;
    
    // Atualizar links de navegação desktop
    const authLinks = document.querySelectorAll('a[href="auth.html"], #btn-entrar-desktop, #btn-entrar-mobile');
    const protectedLinks = document.querySelectorAll('[data-requires-auth], a[href="dashboard.html"], a[href="agendamentos.html"], a[href="mensagens.html"], #dashboard-link, #appointments-link, #messages-link, #dashboard-link-mobile, #appointments-link-mobile, #messages-link-mobile');
    const logoutButtons = document.querySelectorAll('button[onclick="logout()"], #logout-btn-desktop, #logout-btn-mobile');
    
    // Link da conta que deve aparecer quando logado
    const accountLinks = document.querySelectorAll('a[href="conta.html"], #account-link, #account-link-mobile');
    const accountButtons = document.querySelectorAll('#account-btn-desktop, #account-btn-mobile');
    
    // Links de serviços - manter consistente, apenas ajustar href quando necessário
    const serviceLinks = document.querySelectorAll('a[href="servicos.html"], a[href="cadastrar-servico.html"], a[href="#services"]');
    const authOnlyNavLinks = document.querySelectorAll('[data-show-when="authenticated"]');
    const guestOnlyNavLinks = document.querySelectorAll('[data-hide-when="authenticated"]');
    const dynamicServiceLinks = document.querySelectorAll('[data-service-link="true"]');
    
    // Usar classes para esconder/mostrar de forma consistente
    authLinks.forEach(link => {
        if (isAuthenticated) {
            link.classList.add('hidden');
            link.style.display = 'none';
        } else {
            link.classList.remove('hidden');
            link.style.display = '';
        }
    });
    
    protectedLinks.forEach(link => {
        if (isAuthenticated) {
            link.classList.remove('hidden');
            link.style.display = '';
        } else {
            link.classList.add('hidden');
            link.style.display = 'none';
        }
    });

    authOnlyNavLinks.forEach(link => {
        if (isAuthenticated) {
            link.classList.remove('hidden');
            link.style.display = '';
        } else {
            link.classList.add('hidden');
            link.style.display = 'none';
        }
    });

    guestOnlyNavLinks.forEach(link => {
        if (isAuthenticated) {
            link.classList.add('hidden');
            link.style.display = 'none';
        } else {
            link.classList.remove('hidden');
            link.style.display = '';
        }
    });

    dynamicServiceLinks.forEach(link => {
        if (isAuthenticated) {
            link.setAttribute('href', 'servicos.html');
        } else {
            link.setAttribute('href', '#services');
        }
    });
    
    // Esconder botões de logout (não usaremos mais)
    logoutButtons.forEach(button => {
        button.classList.add('hidden');
        button.style.display = 'none';
    });
    
    // Mostrar/esconder botões de conta baseado no status de login
    accountButtons.forEach(button => {
        if (isAuthenticated) {
            button.classList.remove('hidden');
            button.style.display = '';
        } else {
            button.classList.add('hidden');
            button.style.display = 'none';
        }
    });
    
    // Ajustar links de serviços de forma consistente - não mudar texto, apenas href
    const servicesSectionExists = !!document.getElementById('services');

    serviceLinks.forEach(link => {
        if (servicesSectionExists) {
            link.href = '#services';
            return;
        }

        // Resetar para estado padrão primeiro
        if (isAuthenticated && currentUser) {
            if (currentUser.user_type === 'profissional') {
                // Profissionais vão para cadastrar serviços
                if (link.href && !link.href.includes('cadastrar-servico')) {
                    link.href = 'cadastrar-servico.html';
                }
            } else {
                // Clientes vão para buscar serviços
                if (link.href && !link.href.includes('servicos.html')) {
                    link.href = 'servicos.html';
                }
            }
        } else {
            // Quando não logado, manter link de serviços
            if (link.href && link.href.includes('cadastrar-servico')) {
                link.href = 'servicos.html';
            }
            if (link.href && link.href.includes('#services')) {
                link.href = 'servicos.html';
            }
        }
    });
    
    // Mostrar/esconder link da conta baseado no status de login
    accountLinks.forEach(link => {
        if (isAuthenticated) {
            link.classList.remove('hidden');
            link.style.display = '';
        } else {
            link.classList.add('hidden');
            link.style.display = 'none';
        }
    });
    
    // Atualizar nome do usuário se estiver logado
    if (isAuthenticated && currentUser) {
        const userNameElements = document.querySelectorAll('#user-name, .user-name');
        userNameElements.forEach(element => {
            element.textContent = currentUser.name;
        });
    }
}

// Inicialização
(function() {
    // Inicializar dados mock
    initializeMockData();
    
    const saved = localStorage.getItem('servlink-dark');
    setDarkMode(saved === '1');
    const btn = document.getElementById('dark-mode-toggle');
    const btnMobile = document.getElementById('dark-mode-toggle-mobile');
    if (btn) btn.addEventListener('click', toggleDarkMode);
    if (btnMobile) btnMobile.addEventListener('click', toggleDarkMode);

    // Atualizar interface baseada na autenticação
    updateAuthUI();
    
    // Verificar redirecionamento por tipo de usuário
    redirectByUserType();
    
    // Garantir que o menu seja atualizado quando a página carregar completamente
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            updateAuthUI();
        });
    } else {
        // DOM já carregado
        updateAuthUI();
    }
    
    // Iniciar atualizações em tempo real se usuário estiver logado
    if (authToken) {
        startRealTimeUpdates();
    }
})();

// Intersection Observer for fade-in animations
const faders = document.querySelectorAll('.hidden');

const appearOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -100px 0px"
};

const appearOnScroll = new IntersectionObserver(function(entries, appearOnScroll) {
    entries.forEach(entry => {
        if (!entry.isIntersecting) {
            return;
        }
        entry.target.classList.add('fade-in');
        entry.target.classList.remove('hidden');
        appearOnScroll.unobserve(entry.target);
    });
}, appearOptions);

faders.forEach(fader => {
    appearOnScroll.observe(fader);
}); 

function logout() {
    try {
        // Parar atualizações em tempo real
        if (typeof stopRealTimeUpdates === 'function') {
            stopRealTimeUpdates();
        }
        
        // Limpar dados de autenticação
        authToken = null;
        currentUser = null;
        localStorage.removeItem('servlink_token');
        localStorage.removeItem('servlink_user');
        
        // Mostrar mensagem de sucesso
        showSuccessMessage('Logout realizado com sucesso!');
        
        // Atualizar interface
        if (typeof updateAuthUI === 'function') {
            updateAuthUI();
        }
        
        // Redirecionar após um pequeno delay para mostrar a mensagem
        setTimeout(() => {
            navigateToPage('auth.html');
        }, 1000);
    } catch (error) {
        console.error('Erro no logout:', error);
        // Fallback: limpar dados e redirecionar
        localStorage.removeItem('servlink_token');
        localStorage.removeItem('servlink_user');
        navigateToPage('auth.html');
    }
}

// Função para atualizar avaliações de todos os serviços baseado em avaliações reais
function updateAllServiceRatings() {
    const services = JSON.parse(localStorage.getItem('servlink_services') || '[]');
    const reviews = JSON.parse(localStorage.getItem('servlink_reviews') || '[]');
    
    // Atualizar avaliações de cada serviço
    services.forEach(service => {
        const serviceReviews = reviews.filter(r => r.service_id == service.id);
        
        if (serviceReviews.length > 0) {
            const avgRating = serviceReviews.reduce((sum, review) => sum + review.rating, 0) / serviceReviews.length;
            service.avg_rating = parseFloat(avgRating.toFixed(1));
            service.review_count = serviceReviews.length;
        } else {
            // Se não houver avaliações, garantir que está em 0
            service.avg_rating = 0;
            service.review_count = 0;
        }
    });
    
    localStorage.setItem('servlink_services', JSON.stringify(services));
    return services;
}

// Busca de serviços (apenas frontend)
async function searchServices(filters = {}) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Atualizar avaliações de todos os serviços antes de buscar
    const allServices = updateAllServiceRatings();
    
    // Aplicar filtros se fornecidos
    // Por padrão, mostrar apenas serviços ativos (a menos que seja uma busca específica do prestador)
    let filteredServices = allServices.filter(s => {
        // Se for uma busca do próprio prestador (user_id), mostrar todos os status
        if (filters.user_id) {
            return true;
        }
        // Caso contrário, mostrar apenas serviços ativos
        // Inclui serviços sem status definido (compatibilidade com serviços antigos)
        return s.status === 'active' || !s.status;
    });
    
    if (filters.category || filters.category_id) {
        const categoryFilter = filters.category || filters.category_id;
        
        // Mapear ID de categoria para nome se necessário
        const categoryMap = {
            1: 'reparos', 2: 'limpeza', 3: 'pintura', 
            4: 'eletrica', 5: 'encanamento', 6: 'jardinagem'
        };
        
        const categoryValue = categoryMap[categoryFilter] || categoryFilter;
        
        filteredServices = filteredServices.filter(s => {
            // Verificar tanto por ID quanto por nome/valor da categoria
            return s.category === categoryValue || 
                   s.category === categoryFilter ||
                   s.category_id == categoryFilter ||
                   s.category_name?.toLowerCase() === categoryValue?.toLowerCase();
        });
    }
    
    if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredServices = filteredServices.filter(s => 
            s.title.toLowerCase().includes(searchTerm) ||
            s.description.toLowerCase().includes(searchTerm) ||
            s.provider_name.toLowerCase().includes(searchTerm) ||
            (s.tags && Array.isArray(s.tags) && s.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
    }
    
    if (filters.location) {
        filteredServices = filteredServices.filter(s => 
            s.location.toLowerCase().includes(filters.location.toLowerCase())
        );
    }
    
    if (filters.user_id) {
        filteredServices = filteredServices.filter(s => s.provider_id === filters.user_id);
    }
    
    // Ordenação
    if (filters.sort) {
        if (filters.sort === 'rating') {
            filteredServices.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
        } else if (filters.sort === 'price') {
            filteredServices.sort((a, b) => (a.price || 0) - (b.price || 0));
        } else if (filters.sort === 'recent') {
            filteredServices.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        }
    }
    
    // Aplicar limite se especificado
    if (filters.limit && filters.limit > 0) {
        filteredServices = filteredServices.slice(0, filters.limit);
    }
    
    return filteredServices;
}

async function getServiceById(id) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Atualizar avaliações antes de buscar
    const allServices = updateAllServiceRatings();
    const service = allServices.find(s => s.id == id);
    
    if (!service) {
        throw new Error('Serviço não encontrado');
    }
    
    return service;
}

// Gerenciamento de serviços para prestadores
async function createService(serviceData) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const user = JSON.parse(localStorage.getItem('servlink_user') || 'null');
    if (!user || user.user_type !== 'profissional') {
        throw new Error('Apenas profissionais podem cadastrar serviços');
    }
    
    // Obter imagem do perfil do usuário
    // getUserProfileImage já retorna a foto do usuário se ele tiver, ou a padrão se não tiver
    const profileImage = getUserProfileImage(user.id);
    
    const services = JSON.parse(localStorage.getItem('servlink_services') || '[]');
    
    const serviceId = Date.now();
    const normalizedCategory = resolveCategoryData(serviceData);
    const normalizedImages = normalizeImagesInput(serviceData.images);
    const normalizedTags = normalizeTagsInput(serviceData.tags);
    const normalizedPrice = Number(serviceData.price) || 0;
    const priceType = serviceData.price_type || 'service';
    
    const newService = {
        id: serviceId,
        provider_id: user.id,
        provider_name: user.name,
        // NÃO salvar profile_image aqui - sempre buscar dinamicamente com getUserProfileImage
        // profile_image: profileImage, // REMOVIDO - sempre buscar a foto mais atualizada
        title: serviceData.title,
        description: serviceData.description,
        price: normalizedPrice,
        price_type: priceType,
        location: serviceData.location || `${user.city || ''}${user.state ? `, ${user.state}` : ''}`.trim(),
        availability: serviceData.availability || 'flexible',
        experience_years: serviceData.experience_years || 0,
        images: normalizedImages,
        tags: normalizedTags,
        category: normalizedCategory.category,
        category_id: normalizedCategory.category_id,
        category_name: normalizedCategory.category_name,
        created_at: new Date().toISOString(),
        avg_rating: 0, // Sempre começa em 0 (sem avaliações reais)
        review_count: 0, // Sempre começa em 0 (sem avaliações reais)
        status: 'active'
    };
    
    services.push(newService);
    localStorage.setItem('servlink_services', JSON.stringify(services));
    
    showSuccessMessage('Serviço cadastrado com sucesso!');
    return newService;
}

async function getUserServices(userId) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Atualizar avaliações antes de retornar
    const allServices = updateAllServiceRatings();
    return allServices.filter(service => service.provider_id === userId);
}

async function updateService(serviceId, serviceData) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const services = JSON.parse(localStorage.getItem('servlink_services') || '[]');
    const serviceIndex = services.findIndex(s => s.id === serviceId);
    
    if (serviceIndex === -1) {
        throw new Error('Serviço não encontrado');
    }
    
    services[serviceIndex] = { ...services[serviceIndex], ...serviceData };
    localStorage.setItem('servlink_services', JSON.stringify(services));
    
    showSuccessMessage('Serviço atualizado com sucesso!');
    return services[serviceIndex];
}

async function deleteService(serviceId) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const services = JSON.parse(localStorage.getItem('servlink_services') || '[]');
    const filteredServices = services.filter(s => s.id !== serviceId);
    
    if (filteredServices.length === services.length) {
        throw new Error('Serviço não encontrado');
    }
    
    localStorage.setItem('servlink_services', JSON.stringify(filteredServices));
    showSuccessMessage('Serviço removido com sucesso!');
}

// Função helper para obter foto de perfil do usuário
function getUserProfileImage(userId) {
    if (!userId) return DEFAULT_PROFILE_IMAGE;
    
    // Normalizar IDs para comparação
    const userIdNum = Number(userId);
    const userIdStr = String(userId);
    
    // 1. Verificar no currentUser primeiro (mais rápido)
    if (currentUser) {
        const currentId = currentUser.id;
        if (currentId == userId || String(currentId) === userIdStr || Number(currentId) === userIdNum) {
            if (currentUser.profile_image && 
                typeof currentUser.profile_image === 'string' && 
                currentUser.profile_image.trim() !== '' &&
                currentUser.profile_image !== 'null' &&
                currentUser.profile_image !== 'undefined') {
                return currentUser.profile_image.trim();
            }
        }
    }
    
    // 2. Buscar na lista de usuários (SEMPRE fazer isso para garantir foto atualizada)
    try {
        const usersStr = localStorage.getItem('servlink_users');
        if (!usersStr) return DEFAULT_PROFILE_IMAGE;
        
        const users = JSON.parse(usersStr);
        const user = users.find(u => {
            const uId = u.id;
            return uId == userId || String(uId) === userIdStr || Number(uId) === userIdNum;
        });
        
        if (user && user.profile_image) {
            const img = user.profile_image;
            if (typeof img === 'string' && 
                img.trim() !== '' && 
                img !== 'null' && 
                img !== 'undefined') {
                return img.trim();
            }
        }
    } catch (e) {
        console.error('Erro ao buscar foto:', e);
    }
    
    return DEFAULT_PROFILE_IMAGE;
}

// Funções de gerenciamento de conta
async function updateUserProfile(profileData) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const users = JSON.parse(localStorage.getItem('servlink_users') || '[]');
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex === -1) {
        throw new Error('Usuário não encontrado');
    }
    
    // Atualizar dados do usuário
    users[userIndex] = { ...users[userIndex], ...profileData };
    localStorage.setItem('servlink_users', JSON.stringify(users));
    
    // Atualizar usuário atual
    currentUser = { ...currentUser, ...profileData };
    localStorage.setItem('servlink_user', JSON.stringify(currentUser));
    
    showSuccessMessage('Perfil atualizado com sucesso!');
    return currentUser;
}

// Função para atualizar todas as imagens de perfil visíveis na página
function updateAllProfileImages(userId, newImageSrc) {
    if (!userId || !newImageSrc) {
        console.warn('updateAllProfileImages: userId ou newImageSrc inválido', { userId, newImageSrc });
        return;
    }
    
    const userIdStr = String(userId);
    let updatedCount = 0;
    
    // Buscar todos os serviços do usuário uma vez
    let userServices = [];
    try {
        const services = JSON.parse(localStorage.getItem('servlink_services') || '[]');
        userServices = services.filter(s => {
            const providerId = s.provider_id;
            return providerId === userId || String(providerId) === userIdStr || providerId == userId;
        });
    } catch (e) {
        console.error('Erro ao buscar serviços:', e);
    }
    
    // Estratégia 1: Atualizar usando data-provider-id (mais preciso)
    document.querySelectorAll('.service-user-img[data-provider-id]').forEach(img => {
        const providerId = String(img.getAttribute('data-provider-id'));
        if (providerId === userIdStr || providerId == userId) {
            img.src = newImageSrc;
            img.setAttribute('src', newImageSrc);
            updatedCount++;
        }
    });
    
    // Estratégia 2: Se for o currentUser, atualizar TODAS as imagens de serviços do usuário
    const isCurrentUser = currentUser && (currentUser.id === userId || String(currentUser.id) === userIdStr);
    if (isCurrentUser && userServices.length > 0) {
        document.querySelectorAll('.service-user-img').forEach(img => {
            const serviceCard = img.closest('.service-card');
            if (serviceCard) {
                const viewButton = serviceCard.querySelector('.service-view-profile-btn');
                if (viewButton) {
                    const onclickStr = viewButton.getAttribute('onclick') || '';
                    const match = onclickStr.match(/viewService\((\d+)\)/);
                    if (match) {
                        const serviceId = parseInt(match[1]);
                        const service = userServices.find(s => s.id === serviceId);
                        if (service) {
                            img.src = newImageSrc;
                            img.setAttribute('src', newImageSrc);
                            updatedCount++;
                        }
                    }
                }
            }
        });
    }
    
    // Atualizar imagem na página de detalhes do serviço
    document.querySelectorAll('.service-details-user-img[data-provider-id]').forEach(img => {
        const providerId = String(img.getAttribute('data-provider-id'));
        if (providerId === userIdStr || providerId == userId) {
            img.src = newImageSrc;
            img.setAttribute('src', newImageSrc);
            updatedCount++;
        }
    });
    
    // Fallback para página de detalhes sem data-provider-id
    const serviceDetailsImg = document.querySelector('.service-details-user-img:not([data-provider-id])');
    if (serviceDetailsImg) {
        const urlParams = new URLSearchParams(window.location.search);
        const serviceId = urlParams.get('id');
        if (serviceId) {
            try {
                const services = JSON.parse(localStorage.getItem('servlink_services') || '[]');
                const service = services.find(s => s.id === parseInt(serviceId));
                if (service && (service.provider_id === userId || String(service.provider_id) === userIdStr)) {
                    serviceDetailsImg.src = newImageSrc;
                    serviceDetailsImg.setAttribute('src', newImageSrc);
                    updatedCount++;
                }
            } catch (e) {
                console.error('Erro ao verificar serviço:', e);
            }
        } else if (isCurrentUser) {
            serviceDetailsImg.src = newImageSrc;
            serviceDetailsImg.setAttribute('src', newImageSrc);
            updatedCount++;
        }
    }
    
    // Atualizar imagem no dashboard (meus serviços)
    if (isCurrentUser) {
        document.querySelectorAll('#my-services .service-user-img').forEach(img => {
            img.src = newImageSrc;
            img.setAttribute('src', newImageSrc);
            updatedCount++;
        });
    }
    
    // Atualizar avatar na página de conta
    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar && isCurrentUser) {
        userAvatar.src = newImageSrc;
        userAvatar.setAttribute('src', newImageSrc);
        updatedCount++;
    }
    
    // Atualizar imagens em avaliações (reviews)
    document.querySelectorAll('.review-user-img, .review-avatar').forEach(img => {
        const reviewUserId = img.getAttribute('data-user-id');
        if (reviewUserId && (reviewUserId === userIdStr || reviewUserId == userId)) {
            img.src = newImageSrc;
            img.setAttribute('src', newImageSrc);
            updatedCount++;
        }
    });
    
    console.log(`✅ updateAllProfileImages: ${updatedCount} imagens atualizadas para userId ${userId}`);
    
    // Disparar evento customizado para outras partes da aplicação
    window.dispatchEvent(new CustomEvent('profileImageUpdated', {
        detail: { userId, imageSrc: newImageSrc }
    }));
}

// Função para atualizar foto de perfil
async function updateUserProfileImage(imageDataUrl) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const users = JSON.parse(localStorage.getItem('servlink_users') || '[]');
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex === -1) {
        throw new Error('Usuário não encontrado');
    }
    
    // Atualizar foto de perfil do usuário
    users[userIndex].profile_image = imageDataUrl;
    localStorage.setItem('servlink_users', JSON.stringify(users));
    
    // Atualizar usuário atual
    currentUser.profile_image = imageDataUrl;
    localStorage.setItem('servlink_user', JSON.stringify(currentUser));
    
    // Atualizar foto em todos os serviços do usuário no localStorage
    // IMPORTANTE: Isso garante que mesmo que alguém esteja logado como cliente,
    // os serviços do prestador terão a foto atualizada
    const services = JSON.parse(localStorage.getItem('servlink_services') || '[]');
    let servicesUpdated = 0;
    services.forEach(service => {
        const providerId = service.provider_id;
        if (providerId === currentUser.id || 
            String(providerId) === String(currentUser.id) || 
            providerId == currentUser.id) {
            service.profile_image = imageDataUrl;
            servicesUpdated++;
        }
    });
    if (servicesUpdated > 0) {
        localStorage.setItem('servlink_services', JSON.stringify(services));
        console.log(`✅ ${servicesUpdated} serviços atualizados no localStorage para userId ${currentUser.id}`);
    }
    
    // Verificar se a foto foi salva corretamente
    const verifyUser = JSON.parse(localStorage.getItem('servlink_users') || '[]').find(u => u.id === currentUser.id);
    console.log('✅ Foto salva?', {
        userId: currentUser.id,
        currentUserFoto: currentUser.profile_image ? currentUser.profile_image.substring(0, 50) + '...' : 'SEM FOTO',
        localStorageFoto: verifyUser?.profile_image ? verifyUser.profile_image.substring(0, 50) + '...' : 'SEM FOTO',
        servicosAtualizados: servicesUpdated
    });
    
    // Atualizar todas as imagens visíveis na página em tempo real
    console.log('Atualizando imagens de perfil para userId:', currentUser.id);
    updateAllProfileImages(currentUser.id, imageDataUrl);
    
    // Forçar atualização também recarregando serviços se estiverem visíveis
    // Isso garante que serviços renderizados antes da atualização também sejam atualizados
    setTimeout(() => {
        // Atualizar novamente as imagens após um pequeno delay (caso novos elementos tenham sido criados)
        updateAllProfileImages(currentUser.id, imageDataUrl);
        
        // Disparar evento de storage para outras abas/páginas
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'servlink_user',
            newValue: JSON.stringify(currentUser)
        }));
    }, 100);
    
    showSuccessMessage('Foto de perfil atualizada com sucesso!');
    return currentUser;
}

async function changePassword(currentPassword, newPassword) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const users = JSON.parse(localStorage.getItem('servlink_users') || '[]');
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex === -1) {
        throw new Error('Usuário não encontrado');
    }
    
    // Verificar senha atual
    if (users[userIndex].password !== currentPassword) {
        throw new Error('Senha atual incorreta');
    }
    
    // Atualizar senha
    users[userIndex].password = newPassword;
    localStorage.setItem('servlink_users', JSON.stringify(users));
    
    showSuccessMessage('Senha alterada com sucesso!');
}

// Agendamentos (apenas frontend)
async function createAppointment(appointmentData) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const user = JSON.parse(localStorage.getItem('servlink_user') || 'null');
    if (!user) {
        throw new Error('Usuário não encontrado');
    }
    
    // Buscar serviço para obter dados do prestador
    const services = JSON.parse(localStorage.getItem('servlink_services') || '[]');
    const service = services.find(s => s.id == appointmentData.service_id);
    
    if (!service) {
        throw new Error('Serviço não encontrado');
    }
    
    const appointments = JSON.parse(localStorage.getItem('servlink_appointments') || '[]');
    const newAppointment = {
        id: Date.now(),
        service_id: appointmentData.service_id,
        service_title: service.title,
        client_id: user.id,
        client_name: user.name,
        provider_id: service.provider_id,
        provider_name: service.provider_name,
        date: appointmentData.date,
        time: appointmentData.time,
        notes: appointmentData.notes || '',
        status: 'pending',
        created_at: new Date().toISOString()
    };
    
    appointments.push(newAppointment);
    localStorage.setItem('servlink_appointments', JSON.stringify(appointments));
    
    showSuccessMessage('Agendamento criado com sucesso!');
    return newAppointment;
}

async function getAppointments(status = null) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const user = JSON.parse(localStorage.getItem('servlink_user') || 'null');
    if (!user) {
        return [];
    }
    
    const appointments = JSON.parse(localStorage.getItem('servlink_appointments') || '[]');
    
    // Filtrar agendamentos do usuário atual (comparação flexível para aceitar string/number)
    const userAppointments = appointments.filter(appointment => {
        const isClient = appointment.client_id == user.id || String(appointment.client_id) === String(user.id);
        const isProvider = appointment.provider_id == user.id || String(appointment.provider_id) === String(user.id);
        return isClient || isProvider;
    });
    
    if (status) {
        return userAppointments.filter(appointment => appointment.status === status);
    }
    
    return userAppointments;
}

async function updateAppointmentStatus(id, status) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const appointments = JSON.parse(localStorage.getItem('servlink_appointments') || '[]');
    const appointmentIndex = appointments.findIndex(a => a.id == id);
    
    if (appointmentIndex === -1) {
        throw new Error('Agendamento não encontrado');
    }
    
    appointments[appointmentIndex].status = status;
    appointments[appointmentIndex].updated_at = new Date().toISOString();
    
    localStorage.setItem('servlink_appointments', JSON.stringify(appointments));
    showSuccessMessage('Status atualizado com sucesso!');
}

// Mensagens (apenas frontend)
async function sendMessage(messageData) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const user = JSON.parse(localStorage.getItem('servlink_user') || 'null');
    if (!user) {
        throw new Error('Usuário não encontrado');
    }
    
    const messages = JSON.parse(localStorage.getItem('servlink_messages') || '[]');
    const newMessage = {
        id: Date.now(),
        appointment_id: messageData.appointment_id,
        sender_id: user.id,
        sender_name: user.name,
        receiver_id: messageData.receiver_id,
        message: messageData.message,
        created_at: new Date().toISOString()
    };
    
    messages.push(newMessage);
    localStorage.setItem('servlink_messages', JSON.stringify(messages));
    
    return newMessage;
}

async function getMessages(appointmentId) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const messages = JSON.parse(localStorage.getItem('servlink_messages') || '[]');
    return messages.filter(message => message.appointment_id == appointmentId);
}

// Avaliações (apenas frontend)
async function createReview(reviewData) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const user = JSON.parse(localStorage.getItem('servlink_user') || 'null');
    if (!user) {
        throw new Error('Usuário não encontrado');
    }
    
    // Salvar avaliação real
    const reviews = JSON.parse(localStorage.getItem('servlink_reviews') || '[]');
    const newReview = {
        id: Date.now(),
        service_id: reviewData.service_id,
        client_id: user.id,
        client_name: user.name,
        rating: reviewData.rating,
        comment: reviewData.comment,
        created_at: new Date().toISOString()
    };
    
    reviews.push(newReview);
    localStorage.setItem('servlink_reviews', JSON.stringify(reviews));
    
    // Atualizar média de avaliações do serviço
    updateServiceRating(reviewData.service_id);
    
    showSuccessMessage('Avaliação enviada com sucesso!');
    return newReview;
}

// Atualizar média de avaliações de um serviço
function updateServiceRating(serviceId) {
    const services = JSON.parse(localStorage.getItem('servlink_services') || '[]');
    const reviews = JSON.parse(localStorage.getItem('servlink_reviews') || '[]');
    
    // Buscar avaliações reais do serviço
    const serviceReviews = reviews.filter(r => r.service_id == serviceId);
    
    if (serviceReviews.length > 0) {
        const avgRating = serviceReviews.reduce((sum, review) => sum + review.rating, 0) / serviceReviews.length;
        
        // Atualizar serviço
        const serviceIndex = services.findIndex(s => s.id == serviceId);
        if (serviceIndex !== -1) {
            services[serviceIndex].avg_rating = parseFloat(avgRating.toFixed(1));
            services[serviceIndex].review_count = serviceReviews.length;
            localStorage.setItem('servlink_services', JSON.stringify(services));
        }
    }
}

async function getReviews(serviceId) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Buscar apenas avaliações reais
    const reviews = JSON.parse(localStorage.getItem('servlink_reviews') || '[]');
    const serviceReviews = reviews.filter(r => r.service_id == serviceId);
    
    // Ordenar por data (mais recentes primeiro)
    return serviceReviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// Categorias (apenas frontend)
async function getCategories() {
    if (cachedCategories) {
        return cachedCategories;
    }
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 200));
    cachedCategories = getMockCategories();
    return cachedCategories;
}

// Estatísticas (apenas frontend)
async function getStats() {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const users = JSON.parse(localStorage.getItem('servlink_users') || '[]');
    const services = JSON.parse(localStorage.getItem('servlink_services') || '[]');
    const appointments = JSON.parse(localStorage.getItem('servlink_appointments') || '[]');
    const reviews = JSON.parse(localStorage.getItem('servlink_reviews') || '[]');
    
    // Calcular avaliação média apenas de avaliações reais
    const avgRating = reviews.length > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
        : 0; // Se não houver avaliações, retornar 0
    
    return {
        total_users: users.length,
        total_services: services.length,
        total_appointments: appointments.length,
        avg_rating: avgRating
    };
}

// Estatísticas do usuário específico
async function getUserStats(userId) {
    const appointments = JSON.parse(localStorage.getItem('servlink_appointments') || '[]');
    const services = JSON.parse(localStorage.getItem('servlink_services') || '[]');
    const reviews = JSON.parse(localStorage.getItem('servlink_reviews') || '[]');
    
    const userAppointments = appointments.filter(a => a.client_id === userId || a.provider_id === userId);
    const userServices = services.filter(s => s.provider_id === userId);
    const userReviews = reviews.filter(r => r.service_id && services.find(s => s.id === r.service_id && s.provider_id === userId));
    
    const avgRating = userReviews.length > 0 
        ? userReviews.reduce((sum, review) => sum + review.rating, 0) / userReviews.length 
        : 0;
    
    return {
        total_appointments: userAppointments.length,
        pending_appointments: userAppointments.filter(a => a.status === 'pending').length,
        confirmed_appointments: userAppointments.filter(a => a.status === 'confirmed').length,
        completed_appointments: userAppointments.filter(a => a.status === 'completed').length,
        total_services: userServices.length,
        avg_rating: avgRating,
        total_reviews: userReviews.length
    };
}

// Funções de UI
function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showLoading(element) {
    element.innerHTML = '<div class="loading">Carregando...</div>';
}

function hideLoading(element) {
    const loading = element.querySelector('.loading');
    if (loading) {
        loading.remove();
    }
}

// Renderização de serviços
function renderServices(services, container) {
    if (!services.length) {
        container.innerHTML = '<p class="no-results">Nenhum serviço encontrado</p>';
        return;
    }

    container.innerHTML = services.map(service => {
        // monta o HTML com a tag <img> diretamente (sem função auto-executável)
        return `
        <div class="service-card hidden">
            <div class="service-image-container">
                <img src="${getPrimaryServiceImage(service)}" alt="${service.title || 'Serviço'}" class="service-img">
                <div class="service-badge">
                    <i class="fas fa-star"></i> ${(service.avg_rating || 0).toFixed(1)} (${service.review_count || 0})
                </div>
                <div class="service-price">R$ ${formatPriceValue(service.price)}/${getPriceTypeLabel(service.price_type)}</div>
            </div>
    
            <div class="service-info">
                <div class="service-user">
                    <img alt="${service.provider_name || 'Prestador'}" class="service-user-img" data-provider-id="${service.provider_id}">
                    <div class="service-user-details">
                        <h3 style="font-weight: 600; margin: 0 0 0.25rem 0; color: var(--text-color);">${service.title || 'Serviço sem título'}</h3>
                        <p style="margin: 0; color: var(--text-muted); font-size: 0.875rem;">
                            ${service.provider_name || 'Prestador'} • ${service.category_name || service.category || 'Categoria'}
                        </p>
                    </div>
                </div>
    
                <div class="service-desc">${service.description || 'Sem descrição disponível.'}</div>
    
                <div class="service-footer">
                    <div class="service-stars">${generateStars(service.avg_rating || 0)}</div>
                    <span class="service-distance">${service.location || 'Localização não informada'}</span>
                </div>
    
                <button class="service-view-profile-btn" onclick="viewService(${service.id})">Ver Perfil</button>
            </div>
        </div>
        `;
        }).join('');
    
    // DEFINIR src das imagens APÓS criar o HTML (obrigatório para data URLs)
    container.querySelectorAll('.service-user-img').forEach(img => {
        const providerId = img.getAttribute('data-provider-id');
        if (providerId) {
            const profileImg = getUserProfileImage(providerId);
            img.src = profileImg;
            img.setAttribute('src', profileImg);
            
            // Fallback se a imagem falhar
            img.onerror = function() {
                this.onerror = null;
                this.src = DEFAULT_PROFILE_IMAGE;
            };
        }
    });

    // container.innerHTML = services.map(service => `
    //     <div class="service-card hidden">
    //         <div class="service-image-container">
    //             <img src="${getPrimaryServiceImage(service)}" alt="${service.title || 'Serviço'}" class="service-img">
    //                 <div class="service-badge">
    //                 <i class="fas fa-star"></i> ${(service.avg_rating || 0).toFixed(1)} (${service.review_count || 0})
    //             </div>
    //             <div class="service-price">R$ ${formatPriceValue(service.price)}/${getPriceTypeLabel(service.price_type)}</div>
    //         </div>
    //         <div class="service-info">
    //             <div class="service-user">
    //                 ${(() => {
    //                     // Sempre buscar a foto atual do usuário (pode ter sido atualizada)
    //                     // Isso garante que se o usuário atualizar a foto, ela apareça nos serviços
    //                     let imgSrc = getUserProfileImage(service.provider_id);
    //                     // GARANTIR que imgSrc nunca seja vazio, undefined ou null
    //                     if (!imgSrc || typeof imgSrc !== 'string' || imgSrc.trim() === '') {
    //                         imgSrc = DEFAULT_PROFILE_IMAGE;
    //                     }
    //                     return `<img src="${imgSrc}" alt="${service.provider_name || 'Prestador'}" class="service-user">`;
    //                 })()}
    //                 <div class="service-user-details">
    //                     <h3 style="font-weight: 600; margin: 0 0 0.25rem 0; color: var(--text-color);">${service.title || 'Serviço sem título'}</h3>
    //                     <p style="margin: 0; color: var(--text-muted); font-size: 0.875rem;">${service.provider_name || 'Prestador'} • ${service.category_name || service.category || 'Categoria'}</p>
    //                 </div>
    //             </div>
    //             <div class="service-desc">${service.description || 'Sem descrição disponível.'}</div>
    //             <div class="service-footer">
    //                 <div class="service-stars">
    //                     ${generateStars(service.avg_rating || 0)}
    //                 </div>
    //                 <span class="service-distance">${service.location || 'Localização não informada'}</span>
    //             </div>
    //             <button class="service-view-profile-btn" onclick="viewService(${service.id})">Ver Perfil</button>
    //         </div>
    //     </div>
    // `).join('');
    
    // Adicionar event listeners para tratamento de erro nas imagens de perfil
    container.querySelectorAll('.service-user-img').forEach(img => {
        // Verificar ANTES de adicionar listener - se src estiver vazio, corrigir imediatamente
        const currentSrc = img.getAttribute('src') || img.src || '';
        if (!currentSrc || 
            currentSrc.trim() === '' || 
            currentSrc === 'null' || 
            currentSrc === 'undefined' || 
            currentSrc.includes('undefined') || 
            currentSrc.includes('null')) {
            img.src = DEFAULT_PROFILE_IMAGE;
            img.setAttribute('src', DEFAULT_PROFILE_IMAGE);
        }
        
        img.addEventListener('error', function() {
            this.onerror = null;
            this.src = DEFAULT_PROFILE_IMAGE;
            this.setAttribute('src', DEFAULT_PROFILE_IMAGE);
        });
        
        // Verificar novamente após um pequeno delay para garantir
        setTimeout(() => {
            const checkSrc = img.src || img.getAttribute('src') || '';
            if (!checkSrc || 
                checkSrc.trim() === '' || 
                checkSrc === 'null' || 
                checkSrc === 'undefined' ||
                checkSrc.includes('undefined') ||
                checkSrc.includes('null')) {
                img.src = DEFAULT_PROFILE_IMAGE;
                img.setAttribute('src', DEFAULT_PROFILE_IMAGE);
            }
        }, 50);
    });
    
    // Animar cards
    setTimeout(() => {
        container.querySelectorAll('.service-card').forEach((card, index) => {
            setTimeout(() => {
                card.classList.remove('hidden');
                card.classList.add('fade-in');
            }, index * 50);
        });
    }, 10);
}

function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    return stars;
}

// Renderização de agendamentos
function renderAppointments(appointments, container) {
    if (!appointments || !appointments.length) {
        container.innerHTML = '<p class="no-results">Nenhum agendamento encontrado</p>';
        return;
    }

    // Obter usuário atual de forma segura
    const user = currentUser || JSON.parse(localStorage.getItem('servlink_user') || 'null');
    const userId = user ? user.id : null;

    container.innerHTML = appointments.map(appointment => {
        const isClient = userId && (appointment.client_id == userId || String(appointment.client_id) === String(userId));
        const otherPartyName = isClient ? (appointment.provider_name || 'Profissional') : (appointment.client_name || 'Cliente');
        const otherPartyLabel = isClient ? 'Profissional' : 'Cliente';
        
        return `
        <div class="appointment-card">
            <div class="appointment-header">
                <h3>${appointment.service_title || 'Serviço'}</h3>
                <span class="appointment-status status-${appointment.status || 'pending'}">${getStatusText(appointment.status || 'pending')}</span>
            </div>
            <div class="appointment-details">
                <p><strong>Data:</strong> ${formatDate(appointment.date || new Date().toISOString())}</p>
                <p><strong>Horário:</strong> ${appointment.time || '--:--'}</p>
                <p><strong>${otherPartyLabel}:</strong> ${otherPartyName}</p>
                ${appointment.notes ? `<p><strong>Observações:</strong> ${appointment.notes}</p>` : ''}
            </div>
            <div class="appointment-actions">
                ${getAppointmentActions(appointment)}
            </div>
        </div>
    `;
    }).join('');
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendente',
        'confirmed': 'Confirmado',
        'completed': 'Concluído',
        'cancelled': 'Cancelado',
        'active': 'Ativo'
    };
    return statusMap[status] || status;
}

function getAppointmentActions(appointment) {
    const actions = [];
    
    // Obter usuário atual de forma segura
    const user = currentUser || JSON.parse(localStorage.getItem('servlink_user') || 'null');
    const userId = user ? user.id : null;
    
    // Verificar se estamos na página de agendamentos (tem função updateStatus local)
    const isAppointmentsPage = typeof updateStatus === 'function';
    const updateFn = isAppointmentsPage ? 'updateStatus' : 'updateAppointmentStatus';
    
    if (appointment.status === 'pending') {
        const isProvider = userId && (appointment.provider_id == userId || String(appointment.provider_id) === String(userId));
        if (isProvider) {
            actions.push(`
                <button onclick="${updateFn}(${appointment.id}, 'confirmed')" class="btn btn-green">
                    Confirmar
                </button>
                <button onclick="${updateFn}(${appointment.id}, 'cancelled')" class="btn btn-red">
                    Recusar
                </button>
            `);
        } else {
            actions.push(`
                <button onclick="${updateFn}(${appointment.id}, 'cancelled')" class="btn btn-red">
                    Cancelar
                </button>
            `);
        }
    }
    
    if (appointment.status === 'confirmed') {
        actions.push(`
            <button onclick="${updateFn}(${appointment.id}, 'completed')" class="btn btn-blue">
                Marcar como Concluído
            </button>
        `);
    }
    
    actions.push(`
        <button onclick="openChat(${appointment.id})" class="btn btn-outline">
            Chat
        </button>
    `);
    
    return actions.join('');
}

// Renderização de mensagens
function renderMessages(messages, container) {
    container.innerHTML = messages.map(message => `
        <div class="message ${message.sender_id === currentUser.id ? 'message-sent' : 'message-received'}">
            <div class="message-content">
                <p>${message.message}</p>
                <span class="message-time">${formatDateTime(message.created_at)}</span>
            </div>
        </div>
    `).join('');
    
    container.scrollTop = container.scrollHeight;
}

// Renderização de avaliações
function renderReviews(reviews, container) {
    if (!reviews || !reviews.length) {
        container.innerHTML = '<p class="no-results">Nenhuma avaliação encontrada</p>';
        return;
    }

    container.innerHTML = reviews.map(review => {
        // Obter imagem do perfil do cliente de forma segura
        let reviewImage = DEFAULT_PROFILE_IMAGE; // Começar com a padrão
        if (typeof getUserProfileImage === 'function') {
            try {
                const userImage = getUserProfileImage(review.client_id);
                if (userImage) {
                    // Limpar e validar a imagem
                    const cleanedImage = String(userImage).replace(/["']/g, '').trim();
                    // Verificar se a imagem é válida
                    if (cleanedImage && 
                        cleanedImage !== '' && 
                        cleanedImage !== 'null' && 
                        cleanedImage !== 'undefined' &&
                        !cleanedImage.includes('null') &&
                        !cleanedImage.includes('undefined') &&
                        (cleanedImage.startsWith('data:') || cleanedImage.startsWith('http') || cleanedImage.startsWith('/'))) {
                        reviewImage = cleanedImage;
                    }
                }
            } catch (error) {
                console.error('Erro ao obter imagem do perfil:', error);
                reviewImage = DEFAULT_PROFILE_IMAGE;
            }
        }
        
        // Garantir que sempre temos uma imagem válida
        if (!reviewImage || reviewImage === '' || reviewImage === 'null' || reviewImage === 'undefined') {
            reviewImage = DEFAULT_PROFILE_IMAGE;
        }
        
        // Nome do cliente (sem escape, já que não vamos usar no alt)
        const clientName = review.client_name || 'Cliente';
        
        return `
        <div class="review-card">
            <div class="review-header">
                <div class="review-user">
                    <img src="${reviewImage}" alt="${clientName}" class="review-user-img" data-user-id="${review.client_id || ''}">
                    <div>
                        <h4>${clientName}</h4>
                        <div class="review-stars">
                            ${generateStars(review.rating || 0)}
                        </div>
                    </div>
                </div>
                <span class="review-date">${formatDate(review.created_at)}</span>
            </div>
            <p class="review-comment">${review.comment || ''}</p>
        </div>
    `;
    }).join('');
    
    // Adicionar event listeners para tratamento de erro nas imagens de avaliações
    // Fazer imediatamente e depois verificar novamente
    const fixReviewImages = () => {
        container.querySelectorAll('.review-user-img').forEach(img => {
            // Verificar e corrigir src imediatamente
            let currentSrc = img.getAttribute('src') || img.src || '';
            
            // Se src está vazio ou inválido, usar padrão imediatamente
            if (!currentSrc || 
                currentSrc.trim() === '' || 
                currentSrc === 'null' || 
                currentSrc === 'undefined' || 
                currentSrc.includes('undefined') || 
                currentSrc.includes('null') ||
                currentSrc === '#') {
                img.src = DEFAULT_PROFILE_IMAGE;
                img.setAttribute('src', DEFAULT_PROFILE_IMAGE);
                return;
            }
            
            // Verificar se é uma URL válida
            if (!currentSrc.startsWith('data:') && 
                !currentSrc.startsWith('http') && 
                !currentSrc.startsWith('/') &&
                !currentSrc.startsWith('blob:')) {
                img.src = DEFAULT_PROFILE_IMAGE;
                img.setAttribute('src', DEFAULT_PROFILE_IMAGE);
                return;
            }
            
            // Event listener para erro de carregamento
            img.addEventListener('error', function() {
                if (this.src !== DEFAULT_PROFILE_IMAGE) {
                    this.onerror = null;
                    this.src = DEFAULT_PROFILE_IMAGE;
                    this.setAttribute('src', DEFAULT_PROFILE_IMAGE);
                }
            }, { once: true });
            
            // Verificar se a imagem já está quebrada
            if (img.complete && img.naturalHeight === 0 && img.src !== DEFAULT_PROFILE_IMAGE) {
                img.src = DEFAULT_PROFILE_IMAGE;
                img.setAttribute('src', DEFAULT_PROFILE_IMAGE);
            }
        });
    };
    
    // Executar imediatamente
    fixReviewImages();
    
    // Verificar novamente após um pequeno delay para pegar imagens que ainda estão carregando
    setTimeout(fixReviewImages, 50);
    setTimeout(fixReviewImages, 200);
}

// Funções utilitárias
function formatDate(dateString) {
    if (!dateString) return 'Data não informada';
    try {
    const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
    return date.toLocaleDateString('pt-BR');
    } catch (error) {
        return 'Data inválida';
    }
}

function formatDateTime(dateString) {
    if (!dateString) return 'Data não informada';
    try {
    const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
    return date.toLocaleString('pt-BR');
    } catch (error) {
        return 'Data inválida';
    }
}

// Função getMockCategories mantida pois é usada em getCategories()
function getMockCategories() {
    return [
        { id: CATEGORY_MAP.reparos.id, slug: 'reparos', name: 'Reparos', icon: CATEGORY_MAP.reparos.icon, description: 'Serviços de reparo e manutenção' },
        { id: CATEGORY_MAP.limpeza.id, slug: 'limpeza', name: 'Limpeza', icon: CATEGORY_MAP.limpeza.icon, description: 'Serviços de limpeza residencial' },
        { id: CATEGORY_MAP.pintura.id, slug: 'pintura', name: 'Pintura', icon: CATEGORY_MAP.pintura.icon, description: 'Serviços de pintura' },
        { id: CATEGORY_MAP.eletrica.id, slug: 'eletrica', name: 'Elétrica', icon: CATEGORY_MAP.eletrica.icon, description: 'Serviços elétricos' },
        { id: CATEGORY_MAP.encanamento.id, slug: 'encanamento', name: 'Encanamento', icon: CATEGORY_MAP.encanamento.icon, description: 'Serviços de encanamento' },
        { id: CATEGORY_MAP.jardinagem.id, slug: 'jardinagem', name: 'Jardinagem', icon: CATEGORY_MAP.jardinagem.icon, description: 'Serviços de jardinagem' },
        { id: CATEGORY_MAP.outros.id, slug: 'outros', name: 'Outros', icon: CATEGORY_MAP.outros.icon, description: 'Demais categorias' }
    ];
}

// Função getMockStats removida - não é mais utilizada

// Event listeners para formulários
document.addEventListener('DOMContentLoaded', function() {
    // Atualizar menu quando DOM estiver pronto
    updateAuthUI();
    
    // Login form
    const loginForm = document.getElementById('login-form-submit');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            try {
                await login(email, password);
            } catch (error) {
                console.error('Erro no login:', error);
            }
        });
    }

    // Register form
    const registerForm = document.getElementById('signup-form-submit');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;
            
            if (password !== confirmPassword) {
                showErrorMessage('As senhas não coincidem');
                return;
            }
            
            const userData = {
                name: document.getElementById('register-name').value,
                email: document.getElementById('register-email').value,
                password: password,
                phone: document.getElementById('register-phone').value,
                address: document.getElementById('register-address').value,
                city: document.getElementById('register-city').value,
                state: document.getElementById('register-state').value,
                user_type: document.getElementById('register-user-type').value
            };
            
            try {
                await register(userData);
            } catch (error) {
                console.error('Erro no registro:', error);
            }
        });
    }

    // Search form
    const heroSearchForm = document.querySelector('#hero-search-form');
    if (heroSearchForm) {
        heroSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchInput = heroSearchForm.querySelector('input');
            const searchTerm = searchInput.value.trim();
            
            if (!searchTerm) {
                return;
            }

            requireLogin(`servicos.html?search=${encodeURIComponent(searchTerm)}`);
        });
    }

    // Load initial data
    loadInitialData();
    
    // Interceptar cliques em links de serviços quando não logado
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a[href*="servicos.html"]');
        if (!link) return;
        
        // Verificar se é um link de serviços
        const href = link.getAttribute('href');
        if (!href || !href.includes('servicos.html')) return;
        
        // Ignorar se já tem onclick ou data-service-link (já tratado)
        if (link.hasAttribute('onclick') || link.hasAttribute('data-service-link')) return;
        
        // Verificar se o usuário está logado
        const authToken = localStorage.getItem('servlink_token');
        if (!authToken) {
            e.preventDefault();
            e.stopPropagation();
            
            // Usar showErrorMessage se disponível, senão usar alert
            if (typeof showErrorMessage === 'function') {
                showErrorMessage('Você precisa fazer login para ver os serviços.');
                setTimeout(() => {
                    navigateToPage('auth.html');
                }, 1500);
            } else {
                alert('Você precisa fazer login para ver os serviços.');
                navigateToPage('auth.html');
            }
            return false;
        }
    }, true); // Usar capture phase para interceptar antes
});

// Carregar dados iniciais
async function loadInitialData() {
    // Na página inicial, os serviços e categorias já estão no HTML (visuais)
    // Apenas animar os cards que já existem
    const servicesContainer = document.querySelector('#services-grid-home');
    if (servicesContainer) {
        // Animar cards de serviços que já estão no HTML
        setTimeout(() => {
            const serviceCards = servicesContainer.querySelectorAll('.service-card');
            serviceCards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.remove('hidden');
                    card.classList.add('fade-in');
                }, index * 50);
            });
        }, 100);
    }

    // Carregar categorias apenas se não houver cards estáticos (para outras páginas)
    const categoriesContainer = document.querySelector('.categories-grid');
    if (categoriesContainer && categoriesContainer.querySelectorAll('.category-card').length === 0) {
        try {
            const categories = await getCategories();
            renderCategories(categories, categoriesContainer);
        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
        }
    }

    // Carregar serviços reais apenas em outras páginas (não no index.html)
    const servicesContainerOther = document.querySelector('.services-grid:not(#services-grid-home)');
    if (servicesContainerOther) {
        try {
            const services = await searchServices({ 
                limit: 6, 
                sort: 'rating' 
            });
            
            if (services.length > 0) {
                renderServices(services, servicesContainerOther);
            } else {
                servicesContainerOther.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                        <i class="fas fa-info-circle" style="font-size: 3rem; margin-bottom: 1rem; display: block; color: var(--blue);"></i>
                        <h3 style="margin-bottom: 0.5rem; color: var(--text-color);">Nenhum serviço cadastrado ainda</h3>
                        <p>Seja o primeiro a cadastrar um serviço e apareça aqui!</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Erro ao carregar serviços:', error);
            servicesContainerOther.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <p>Erro ao carregar serviços. Tente novamente mais tarde.</p>
                </div>
            `;
        }
    }

    // Carregar estatísticas
    const statsContainer = document.querySelector('.stats-grid');
    if (statsContainer) {
        try {
            const stats = await getStats();
            if (stats) {
                renderStats(stats, statsContainer);
            }
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        }
    }
}

function renderCategories(categories, container) {
    container.innerHTML = categories.map(category => `
        <div class="category-card" onclick="filterByCategory(${category.id})">
            <div class="category-icon cat-blue">
                <i class="${category.icon}"></i>
            </div>
            <div class="category-title">${category.name}</div>
            <div class="category-count">${Math.floor(Math.random() * 200) + 50} profissionais</div>
        </div>
    `).join('');
}

function renderStats(stats, container) {
    container.innerHTML = `
        <div class="stat">
            <div class="stat-value stat-blue">${stats.total_users}+</div>
            <div class="stat-label">Usuários</div>
        </div>
        <div class="stat">
            <div class="stat-value stat-green">${stats.total_services}+</div>
            <div class="stat-label">Serviços</div>
        </div>
        <div class="stat">
            <div class="stat-value stat-yellow">${stats.total_appointments}+</div>
            <div class="stat-label">Agendamentos</div>
        </div>
        <div class="stat">
            <div class="stat-value stat-purple">${stats.avg_rating ? stats.avg_rating.toFixed(1) : '4.5'}</div>
            <div class="stat-label">Avaliação Média</div>
        </div>
    `;
}

// Sistema de notificações em tempo real
function startRealTimeUpdates() {
    // Atualizar dados a cada 30 segundos
    notificationInterval = setInterval(async () => {
        await updateDashboardData();
    }, 30000);
}

function stopRealTimeUpdates() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }
}

async function updateDashboardData() {
    try {
        const user = JSON.parse(localStorage.getItem('servlink_user') || 'null');
        if (!user) return;
        
        // Verificar novos agendamentos
        const appointments = await getAppointments();
        const pendingCount = appointments.filter(a => a.status === 'pending').length;
        
        // Mostrar notificação se houver novos agendamentos pendentes
        if (pendingCount > 0) {
            showNotification(`Você tem ${pendingCount} agendamento(s) pendente(s)!`);
        }
        
        // Atualizar contadores se estivermos na página de agendamentos
        if (window.location.pathname.includes('agendamentos.html')) {
            const statsContainer = document.querySelector('.stats-grid');
            if (statsContainer) {
                updateAppointmentStats(appointments);
            }
        }
        
    } catch (error) {
        console.error('Erro ao atualizar dados:', error);
    }
}

function showNotification(message) {
    // Verificar se já existe uma notificação similar
    const existingNotifications = document.querySelectorAll('.notification');
    const hasSimilarNotification = Array.from(existingNotifications).some(notif => 
        notif.textContent.includes(message.split(' ')[0])
    );
    
    if (hasSimilarNotification) return;
    
    const notification = document.createElement('div');
    notification.className = 'notification notification-info';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-bell"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function updateAppointmentStats(appointments) {
    const pending = appointments.filter(a => a.status === 'pending').length;
    const confirmed = appointments.filter(a => a.status === 'confirmed').length;
    const completed = appointments.filter(a => a.status === 'completed').length;
    const total = appointments.length;

    const pendingEl = document.getElementById('pending-count');
    const confirmedEl = document.getElementById('confirmed-count');
    const completedEl = document.getElementById('completed-count');
    const totalEl = document.getElementById('total-count');
    
    if (pendingEl) pendingEl.textContent = pending;
    if (confirmedEl) confirmedEl.textContent = confirmed;
    if (completedEl) completedEl.textContent = completed;
    if (totalEl) totalEl.textContent = total;
}

// Controle de acesso por tipo de usuário
function checkUserAccess(pageType) {
    const user = JSON.parse(localStorage.getItem('servlink_user') || 'null');
    const token = localStorage.getItem('servlink_token');
    
    if (!token || !user) {
        showErrorMessage('Você precisa estar logado para acessar esta página.');
        navigateToPage('auth.html');
        return false;
    }
    
    // Verificar acesso baseado no tipo de página
    switch (pageType) {
        case 'services-create':
            if (user.user_type !== 'profissional') {
                showErrorMessage('Apenas profissionais podem cadastrar serviços.');
                navigateToPage('dashboard.html');
                return false;
            }
            break;
        case 'services-manage':
            if (user.user_type !== 'profissional') {
                showErrorMessage('Apenas profissionais podem gerenciar serviços.');
                navigateToPage('dashboard.html');
                return false;
            }
            break;
        case 'appointments-create':
            if (user.user_type !== 'cliente') {
                showErrorMessage('Apenas clientes podem criar agendamentos.');
                navigateToPage('dashboard.html');
                return false;
            }
            break;
    }
    
    return true;
}

// Redirecionar usuários para páginas corretas baseado no tipo
function redirectByUserType() {
    const user = JSON.parse(localStorage.getItem('servlink_user') || 'null');
    if (!user) return;
    
    const currentPage = window.location.pathname;
    
    // Se cliente tentar acessar página de cadastrar serviço
    if (currentPage.includes('cadastrar-servico.html') && user.user_type === 'cliente') {
        showErrorMessage('Apenas profissionais podem cadastrar serviços.');
        navigateToPage('dashboard.html');
        return;
    }
    
    // Se profissional tentar acessar página de criar agendamento
    if (currentPage.includes('agendamentos.html') && user.user_type === 'profissional') {
        // Profissionais podem ver agendamentos, mas não criar novos
        // Isso será controlado na própria página
    }
}

// Funções de navegação
function requireLogin(pagePath) {
    const authToken = localStorage.getItem('servlink_token');
    if (!authToken) {
        // Mostrar mensagem e redirecionar para login
        showErrorMessage('Você precisa fazer login para ver os serviços.');
        setTimeout(() => {
            navigateToPage('auth.html');
        }, 1500);
        return false;
    }
    // Se estiver logado, navegar normalmente
    navigateToPage(pagePath);
    return true;
}

function filterByCategory(categoryId) {
    requireLogin(`servicos.html?category=${categoryId}`);
}

function viewService(serviceId) {
    requireLogin(`servico-detalhes.html?id=${serviceId}`);
}

function openChat(appointmentId) {
    navigateToPage(`mensagens.html?appointment=${appointmentId}`);
}
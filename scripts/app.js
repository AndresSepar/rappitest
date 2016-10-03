var APP = {};
Object.defineProperty(
  APP,
  'SETTINGS', {
    value: {
      TITLE: 'Rappidos',
      URL: 'assets/data/'
    }
  }
);


onConfig.$inject = ['$locationProvider', '$stateProvider', '$urlRouterProvider', 'Settings'];
function onConfig($locationProvider, $stateProvider, $urlRouterProvider, Settings) {

  $locationProvider.html5Mode(true);

  $stateProvider.state('store', {
    title: 'Tienda',
    url: '/',
    controller: 'StoreController',
    controllerAs: 'vm',
    templateUrl: 'partials/store.html',
  })
  $urlRouterProvider.otherwise('/');
}

onRun.$inject = ['$rootScope', '$state', '$database', 'Settings'];
function onRun($rootScope, $state, $database, Settings) {

  if ( $database.isStorable() && !localStorage.categories ){
    $database.connect();
  }

  $rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
    $database.connect();
  });

  $rootScope.$on('$stateChangeSuccess', (event, next) => {
    $rootScope.VIEW_TITLE = next.title ? next.title + ' \u2014 ' + Settings.TITLE : Settings.TITLE;
    //console.log('title', $rootScope.VIEW_TITLE);
  });
}


angular.module('app.controllers', [])
  .controller('StoreController', StoreController);

var appFactories = angular.module('app.factories', []);

var appFilters = angular.module('app.filters', []);

appFilters.filter('gt', function () {
  return function ( items, value, reverse ) {
    if ( !value ) return items;
    var filteredItems = []
    angular.forEach(items, function ( item ) {
      if ( item.price > value ) {
        filteredItems.push(item);
      }
    });
    return filteredItems;
  }
});

appFilters.filter('lt', function () {
  return function ( items, value ) {
    if ( !value ) return items;
    var filteredItems = []
    angular.forEach(items, function ( item ) {
      if ( item.price < value ) {
        filteredItems.push(item);
      }
    });
    return filteredItems;
  }
});

var appServices = angular.module('app.services', []);

appServices.service('Connect', ['$http', 'Settings', function ConnectService($http, Settings){
  this.get = function(path, params = '') {
    return $http.get(url(path), {params: params});
  };

  this.post = function(path, params = '', config = '') {
    return $http.post(url(path), params, config);
  };

  function url(path){
    return [Settings.URL, path].join('/').replace(/([^:]\/)\/+/g, '$1');
  }
}]);

appServices.service('$database', ['$rootScope', '$q', 'Connect', function StorageService($rootScope, $q, Connect) {

  this.connect = function() {

    Connect.get('data.json').then(function(response){
      var products = response.data.products.map(function( item ){
        item.price = Number(item.price.replace('.', ''));
        return item;
      });

      var categories = response.data.categories.map(function( item ){
        item.selected = false;
        if ( item.categori_id ) {
          item.category_id = item.categori_id;
          delete item.categori_id;
        }
        return item;
      });

      localStorage.products = JSON.stringify(products);
      localStorage.categories = JSON.stringify(categories);

      localStorage.cart = localStorage.cart && localStorage.cart.length > 2 ? localStorage.cart : JSON.stringify([]);
    });
  };

  this.getTable = function( data ) {
    if (this.isStorable) {
      return JSON.parse(localStorage[data]);
    }
  };

  this.addToCart = function( item ) {
    if (this.isStorable) {
      var product = angular.copy( item ),
          data = JSON.parse(localStorage.cart) || [];

      if ( this.checkIndex(data, product.id) ) {
        data.filter(function( it ){
          if (it.id === product.id){
            it.qty = it.qty + 1;
          }
          return it;
        });
      } else {
        product.qty = 1;
        data.push( product );
      }

      localStorage.cart = JSON.stringify(data);
      Sync();
    }
  };

  this.removeItem = function( item ) {
    if (this.isStorable) {
      var data = JSON.parse(localStorage.cart).filter(function( it ){
        if (it.id != item.id){
          return it;
        }
      });
      localStorage.cart = JSON.stringify(data);
      Sync();
    }
  };

  this.isStorable = function() {
    try {
      if ('localStorage' in window && window.localStorage !== null) {
        localStorage._____test = 'test';
        delete localStorage._____test;
        return true;
      } else {
        return false;
      }
    } catch (e) {
      return false;
    }
  };

  this.checkIndex = function(data, index) {
    return data.some(function(row) {
      return index === row.id;
    });
  };

  function Sync(){
    var data = JSON.parse(localStorage.cart) || [];
    $rootScope.$emit( 'CART.UPDATE', data );
  }
}]);


var appComponents = angular.module('app.components', []);

appComponents.component('cart', {
  bindings: {
    model: '='
  },
  controller: ['$rootScope', '$scope', '$element', '$database', function ($rootScope, $scope, $element, $database) {

    $element.addClass('Cart');

    var vm = this;

    vm.isOpen = false;
    vm.cart = [];
    vm.total = 0;
    vm.onToggle = onToggle;
    vm.onRemoveItem = onRemoveItem;

    vm.$onInit = function(){
      refresh();
    };

    function onToggle() {
      vm.isOpen = !vm.isOpen;
      refresh();
    }

    function refresh() {
      vm.cart = $database.getTable('cart');
      vm.total = vm.cart.reduce( function(a, b) { return a + (b.qty * Number(b.price)); }, 0 );
    }

    function onRemoveItem( item ){
      if ( confirm('Are you sure you want to remove "' + item.name + '"') ){
        $database.removeItem( item );
      }
    }

    var deregister = $rootScope.$on( 'CART.UPDATE', refresh );
    vm.$onDestroy = function(){ deregister = angular.noop(); };

  }],
  controllerAs: 'vm',
  template: [
    '<i class="fa fa-shopping-cart" ng-click="vm.onToggle()"></i>',
    '<div class="Cart-popup" ng-show="vm.isOpen">',
      '<h4 class="Cart-total" ng-if="vm.cart.length">Total: <span>{{ vm.total | currency : "$" : 0 }}</span></h4>',
      '<div class="Cart-list">',
        '<div class="Cart-listHeader" ng-if="vm.cart.length">',
          '<span class="Cart-listBox"></span>',
          '<span class="Cart-listBox">Product</span>',
          '<span class="Cart-listBox Cart-listBox--right">Price</span>',
          '<span class="Cart-listBox Cart-listBox--center">Qty</span>',
          '<span class="Cart-listBox Cart-listBox--right">Subtotal</span>',
        '</div>',
        '<div class="Cart-listItem" ng-repeat="item in vm.cart track by $index">',
          '<span class="Cart-listBox Cart-remove" title="Click to remove" ng-click="vm.onRemoveItem( item )">&times;</span>',
          '<span class="Cart-listBox">{{item.name}}</span>',
          '<span class="Cart-listBox Cart-listBox--right">{{ item.price | currency : "$" : 0 }}</span>',
          '<span class="Cart-listBox Cart-listBox--center">{{item.qty}}</span>',
          '<span class="Cart-listBox Cart-listBox--right">{{(item.qty * item.price) | currency : "$" : 0}}</span>',
        '</div>',
        '<div class="Cart-listItem" ng-if="!vm.cart.length">Empty cart</div>',
      '</div>',
    '</div>'
  ].join('')
});

angular.module('app', ['ui.router', 'app.controllers', 'app.factories', 'app.services', 'app.components', 'app.filters'])
  .constant('Settings', APP.SETTINGS)
  .config(onConfig)
  .run(onRun);

angular.bootstrap(document, ['app'], { strictDi: true });


StoreController.$inject = ['$scope', '$database'];
function StoreController($scope, $database){
  var vm = this;

  vm.products = $database.getTable('products');
  vm.categories = $database.getTable('categories');

  vm.addToCart = function( product ){
    $database.addToCart( product );
  };
}

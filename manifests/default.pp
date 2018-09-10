# Puppet manifest for setting up lib.reviews on Debian Jessie

# Set $PATH for all Exec resources
Exec {
  path => '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
}

# Make sure apt can fetch packages via https
package { 'apt-transport-https':
  ensure => present,
  before => Exec['apt-get update'],
}

exec { 'apt-get update':
  refreshonly => true,
}

# Increase inotify.max_user_watches. Otherwise pm2 (which watches
# the filesystem for changes) can crash on an unhandled ENOSPC.
file { '/etc/sysctl.d/10-fswatch.conf':
  content => "fs.inotify.max_user_watches = 524288\n",
  notify  => Exec['update_max_user_watches'],
}

exec { 'update_max_user_watches':
  command => 'sysctl --load=/etc/sysctl.d/*.conf',
  unless  => 'sysctl fs.inotify.max_user_watches | grep -q 524288',
  before  => Service['lib-reviews'],
}


#
# RethinkDB
#

exec { 'download package':
  cwd => '/home/vagrant',
  command => 'sudo wget -nc http://samuelhughes.com/misc/bin/rethinkdb_2.3.6+stretch~0stretch_amd64.deb -O rethinkdb_2.3.6.deb',
  unless => 'apt list --installed|grep rethinkdb'
}

package { ['libcurl3','libprotobuf10' ]:
  ensure  => present,
  require => Exec['apt-get update'],
}

package { [ 'rethinkdb' ]:
  name => 'rethinkdb_2.3.6.deb',
  source => '/home/vagrant/rethinkdb_2.3.6.deb',
  provider => 'dpkg',
  ensure  => present,
  require => Package['libcurl3','libprotobuf10'],
}

file { '/etc/rethinkdb/instances.d/default.conf':
  source  => 'file:///etc/rethinkdb/default.conf.sample',
  replace => false,
  require => Package['rethinkdb'],
}

service { 'rethinkdb':
  ensure   => running,
  enable   => true,
  provider => 'systemd',
  require  => File['/etc/rethinkdb/instances.d/default.conf'],
}

exec { '/etc/init.d/rethinkdb start':
  unless  => '/etc/init.d/rethinkdb status | grep -q running',
  require => Service['rethinkdb'],
}


#
# Node.js
#

exec { 'add_nodesource_apt_key':
  command => 'wget -qO- https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -',
  unless  => 'apt-key list | grep -q NodeSource',
}

file { '/etc/apt/sources.list.d/nodesource.list':
  content => "deb https://deb.nodesource.com/node_8.x ${lsbdistcodename} main\n",
  require => Exec['add_nodesource_apt_key'],
  notify  => Exec['apt-get update'],
}

package { ['build-essential', 'git' ,'libcap2-bin', 'nodejs' ]:
  ensure  => present,
  require => Exec['apt-get update'],
}


# Allow nodejs to bind privileged ports. We wouldn't do this in a production
# environment, but it's OK for a throwaway VM.
# not working 2016-09-08
# exec { 'setcap_node':
#  command => 'sudo setcap "cap_net_bind_service=+ep" /usr/bin/nodejs',
#  unless  => 'getcap /usr/bin/nodejs | grep -q cap_net_bind_service',
#  require => Package['libcap2-bin'],
#}


#
# Application setup
#

#exec { 'sudo npm install':
#  cwd     => '/vagrant',
#  onlyif  => 'test ! -d /vagrant/node_modules || ( npm outdated | grep MISSING )',
#  require => Package['build-essential', 'nodejs'],
#}

exec { 'grunt':
  cwd     => '/vagrant',
  command => '/vagrant/node_modules/grunt/bin/grunt',
  creates => '/vagrant/static/js',
#  require => Exec['sudo npm install'],
}

file { '/lib/systemd/system/lib-reviews.service':
  source  => '/vagrant/manifests/lib-reviews.service',
  owner   => 'root',
  group   => 'root',
  mode    => '0444',
  require => Exec['grunt'], #'sudo npm install',
  notify  => Exec['systemctl daemon-reload'],
}

exec { 'systemctl daemon-reload':
  refreshonly => true,
  notify      => Service['lib-reviews'],
}

service { 'lib-reviews':
  ensure   => running,
  enable   => true,
  provider => systemd,
  require  => File['/lib/systemd/system/lib-reviews.service'],
}

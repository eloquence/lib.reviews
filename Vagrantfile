# -*- mode: ruby -*-
# vi: set ft=ruby :
#
# Vagrantfile for lib.reviews
# ===========================
# This Vagrantfile can spin up a box for lib.reviews development.
# It won't actually start lib.reviews by itself. To do that,
# run 'vagrant ssh', then run 'cd /srv/lib.reviews && npm start'.
#
Vagrant.configure('2') do |config|
  config.vm.box = 'debian/jessie64'

  config.vm.post_up_message = <<-END
    To start lib.reviews, run 'vagrant ssh', then 'cd /srv/lib.reviews && npm start'.
    lib.reviews will then run on http://localhost:8080 (on the host)."
  END

  # Make lib.reviews reachable via http://localhost:8080/ on the host.
  config.vm.network :forwarded_port, guest: 80, host: 8080

  # The debian/jessie64 box doesn't come with Puppet pre-installed,
  # so we need to run the shell provisioner first.
  config.vm.provision 'shell', inline: '/usr/bin/apt-get install -y puppet'

  config.vm.provision 'puppet' do |puppet|
    # Uncomment the line below to make Puppet runs vebrose:
    # puppet.options = '--verbose --debug'
  end
end
